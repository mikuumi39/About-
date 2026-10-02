#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai_modify.py —— 调用「AI 修改接口」的稳健客户端（同步 / 异步自动识别）

特性
----
* 总截止时间 15 分钟（可改），到点抛 TimeoutError
* 遇到 429 / 500 / 502 / 503 / 504 不立刻失败，指数退避温和重试：
    - 初始等 2 秒，每次翻倍，最大 60 秒，加 0~1 秒随机抖动
    - 响应头带 Retry-After 时，优先按 Retry-After 等待
* 读超时放宽到 120 秒，AI 处理慢不会被过早断开
* 自动识别异步任务：提交后若返回 task_id / job_id + status，
  则每 5~15 秒随机间隔温和轮询，直到成功 / 失败 / 超时
* 只重试 429 和 5xx；401 / 403 / 400 等错误直接抛出，不做无谓重试

用法
----
1) 安装依赖：                  pip install requests
2) 设置密钥（推荐环境变量，别写死在代码里）：
       Linux/macOS:            export AI_MODIFY_API_KEY='你的密钥'
       Windows (cmd):          set AI_MODIFY_API_KEY=你的密钥
3) 修改下面的 CONFIG 区：接口地址、payload 字段名、任务状态字段……
4) 运行：                      python ai_modify.py "帮我改一下这段话"
   或在其它代码里调用：
       from ai_modify import ai_modify_hardcore
       result = ai_modify_hardcore(API_URL, build_payload("原文"))
"""

from __future__ import annotations

import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Optional

import requests

# =====================================================================
# ① 需要你替换的配置（CONFIG）
# =====================================================================

# 1) 接口地址。例如 "https://api.example.com/v1/ai/modify"
API_URL: str = "https://api.example.com/v1/ai/modify"

# 2) API Key：建议用环境变量。请不要再把真实密钥发到聊天 / 写进代码！
API_KEY: str = os.environ.get("AI_MODIFY_API_KEY", "").strip()

# 3) 请求头。鉴权方式不同这一行要相应改：
#    - OpenAI 风格：      "Authorization": f"Bearer {API_KEY}"
#    - 自定义头：          "X-API-Key": API_KEY
#    - key 放 query：      URL 里写 ?key=...，这里删掉 Authorization 行
#    - 不需要鉴权：        删掉 Authorization 行
HEADERS: dict[str, str] = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# 4) payload 模板：text 是要交给 AI 修改的原文；按你的接口把字段名替换正确。
#    **extra 允许调用时传额外参数，如 build_payload(s, temperature=0.3)
def build_payload(text: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "prompt": text,          # ← 换成你接口的字段名，如 "text" / "content"
        # "model": "your-model", # ← 如果接口需要指定模型，把这里填上
    }
    payload.update(extra)
    return payload


# 5) 异步任务相关（接口支持 task_id / job_id / status 时才用到）
FORCE_MODE: str = "auto"         # "auto" 自动判断 | "sync" 强制同步 | "async" 强制异步

# 提交后轮询状态的地址模板，{} 会被替换成任务 id。
# 路径式：  "{base}/{task_id}"                       → GET /v1/ai/tasks/12345
# 查询式：  "{base}?task_id={task_id}"
STATUS_URL_TEMPLATE: str = "{base}/{task_id}"

# 查询状态用什么方法；有些接口要求 POST 并把 task_id 放在 body 里
STATUS_METHOD: str = "GET"       # "GET" 或 "POST"

# 每轮轮询之间随机等 5~15 秒（温和轮询，不暴力请求）
POLL_INTERVAL_RANGE: tuple[float, float] = (5.0, 15.0)

# 任务状态字段名（兼容嵌套在 "data" 里）
STATUS_FIELD: str = "status"

# 状态值约定（比较时统一转小写；按你的接口实际返回值补充）
DONE_STATUSES = {
    "success", "succeeded", "completed", "done", "finished", "ok",
}
PENDING_STATUSES = {
    "pending", "queued", "created", "accepted", "submitted",
    "running", "processing", "in_progress", "working",
}
FAILED_STATUSES = {
    "failed", "error", "cancelled", "canceled", "timeout", "dead",
}

# 任务完成时优先取哪个字段作为最终结果；取不到就返回整个 JSON
RESULT_FIELD: str = "result"

# ---------------------------------------------------------------------
# ② 重试 / 超时参数（按你的要求设定，一般不用改）
# ---------------------------------------------------------------------
TOTAL_DEADLINE_SECONDS: float = 15 * 60   # 总截止时间 15 分钟
INITIAL_BACKOFF: float = 2.0              # 初始等待 2 秒
MAX_BACKOFF: float = 60.0                 # 最大等待 60 秒
JITTER_MAX: float = 1.0                   # 随机抖动上限（秒）
CONNECT_TIMEOUT: float = 10.0             # 连接超时 10 秒
READ_TIMEOUT: float = 120.0               # 读超时 120 秒
RETRYABLE_STATUS: set[int] = {429, 500, 502, 503, 504}


# =====================================================================
# ③ 内部实现（一般不用改）
# =====================================================================

class ApiTaskError(RuntimeError):
    """服务端明确判定任务失败。"""


class DeadlineExceeded(TimeoutError):
    """总截止时间内没有拿到结果。"""


def _now() -> float:
    # 单调时钟：不受改系统时间影响
    return time.monotonic()


def _retry_after_seconds(resp: requests.Response) -> Optional[float]:
    """解析 Retry-After 头：支持秒数（常见）和 HTTP 日期两种格式。"""
    raw = resp.headers.get("Retry-After")
    if raw is None:
        return None
    raw = raw.strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        pass
    try:  # 少数服务器返回 GMT 日期，如 "Wed, 21 Oct 2026 07:28:00 GMT"
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0.0, (dt - datetime.now(timezone.utc)).total_seconds())
    except (TypeError, ValueError):
        return None


def _backoff_wait(attempt: int, remaining: float,
                  resp: Optional[requests.Response] = None) -> float:
    """
    计算本次需要等待的秒数：
      * 有 Retry-After 头 → 优先按 Retry-After 等（不加多余抖动，
        避免同一瞬间大家同时重试造成风暴）
      * 否则指数退避：min(2 * 2**attempt, 60) + 0~1 秒抖动
    结果再被「剩余时间」截断；截断后 ≤0 表示没时间再等了。
    """
    if resp is not None:
        ra = _retry_after_seconds(resp)
        if ra is not None:
            return max(0.0, min(ra, remaining))
    base = min(INITIAL_BACKOFF * (2 ** attempt), MAX_BACKOFF)
    wait = base + random.uniform(0, JITTER_MAX)
    return max(0.0, min(wait, remaining))


def _sleep_safely(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def _parse_json(resp: requests.Response) -> Any:
    try:
        return resp.json()
    except ValueError:
        return resp.text


def _request_with_retry(method: str, url: str, deadline: float, headers: dict,
                        json_body: Optional[dict] = None) -> requests.Response:
    """
    带指数退避的通用请求：
      * 只在 429 / 5xx 时重试（Retry-After 优先）
      * 网络异常（连接失败 / 超时 / 断连）也温和重试
      * 其它 HTTP 错误直接 raise
    """
    attempt = 0
    while True:
        remaining = deadline - _now()
        if remaining <= 0:
            raise DeadlineExceeded(f"15 分钟内没有成功（{method} {url} 未完成）")
        timeout = (CONNECT_TIMEOUT, max(1.0, min(READ_TIMEOUT, remaining)))
        try:
            resp = requests.request(
                method, url, json=json_body, headers=headers, timeout=timeout
            )
        except requests.RequestException as e:
            print(f"  ⚠ 请求异常：{e}")
            wait = _backoff_wait(attempt, remaining)
            if wait <= 0:
                raise DeadlineExceeded(
                    f"15 分钟内没有成功（请求异常：{e}）") from e
            print(f"    等 {wait:.1f}s 后重试 (¦3[▓▓]")
            _sleep_safely(wait)
            attempt += 1
            continue

        if resp.status_code == 200:
            return resp

        if resp.status_code in RETRYABLE_STATUS:
            wait = _backoff_wait(attempt, remaining, resp)
            if wait <= 0:
                raise DeadlineExceeded(
                    f"15 分钟内没有成功（状态 {resp.status_code}）")
            print(f"  ⚠ 服务器 {resp.status_code}，"
                  f"等 {wait:.1f}s 后重试 (¦3[▓▓]")
            _sleep_safely(wait)
            attempt += 1
            continue

        # 400 / 401 / 403 / 404 等：不重试，直接抛出（改错也白等）
        resp.raise_for_status()
    # unreachable


# ---- 异步任务字段识别辅助 ----

_TASK_ID_KEYS = ("task_id", "job_id", "taskId", "jobId",
                 "request_id", "requestId", "tid", "id")


def _find_task_id(j: Any) -> Optional[str]:
    if not isinstance(j, dict):
        return None
    for k in _TASK_ID_KEYS:
        if k in j:
            return j[k]
    data = j.get("data")
    if isinstance(data, dict):
        for k in _TASK_ID_KEYS:
            if k in data:
                return data[k]
    return None


def _find_status(j: Any) -> Any:
    if not isinstance(j, dict):
        return None
    if STATUS_FIELD in j:
        return j[STATUS_FIELD]
    data = j.get("data")
    if isinstance(data, dict) and STATUS_FIELD in data:
        return data[STATUS_FIELD]
    return None


def _has_result(j: Any) -> bool:
    """响应里是否已包含最终结果（用于判断是不是同步接口）。"""
    if not isinstance(j, dict):
        return False
    for k in (RESULT_FIELD, "output", "text", "content",
              "response", "answer", "message", "choices"):
        v = j.get(k)
        if v is None:
            continue
        if isinstance(v, list):
            if v:
                return True
            continue
        return True
    return False


def _extract_result(j: Any) -> Any:
    """从完成响应里尽量挖出真正的内容（content / text / result…）。"""
    if not isinstance(j, dict):
        return j
    for k in (RESULT_FIELD, "output", "text", "content",
              "response", "answer", "message", "choices"):
        v = j.get(k)
        if v is None:
            continue
        if k == "choices" and isinstance(v, list) and v:  # OpenAI 风格
            c = v[0]
            if isinstance(c, dict) and c.get("message"):
                msg = c["message"]
                return msg.get("content", msg)
            return c
        if isinstance(v, dict):
            return _extract_result(v)
        return v
    return j


# =====================================================================
# ④ 主函数
# =====================================================================

def ai_modify_hardcore(url: Optional[str] = None,
                       payload: Optional[dict] = None,
                       headers: Optional[dict] = None,
                       deadline_seconds: float = TOTAL_DEADLINE_SECONDS,
                       mode: str = FORCE_MODE) -> Any:
    """
    调用 AI 修改接口，带 15 分钟总截止时间与指数退避。

    参数
    ----
    url        : 接口地址（默认用 CONFIG 里的 API_URL）
    payload    : 请求体（默认用 build_payload 的结果）
    headers    : 请求头（默认用 CONFIG 里的 HEADERS）
    deadline_seconds : 总截止时间，默认 900 秒
    mode       : "auto" 自动判断同步/异步 | "sync" | "async"

    返回
    ----
    同步接口：200 响应里的结果（尽量提取内容字段）
    异步接口：任务完成时的结果
    失败时抛 ApiTaskError；超时抛 DeadlineExceeded(TimeoutError)
    """
    url = url or API_URL
    payload = payload or {}
    headers = headers or HEADERS
    if not API_KEY:
        print("⚠ 未设置 AI_MODIFY_API_KEY 环境变量，接口可能返回 401/403")

    deadline = _now() + deadline_seconds
    print(f"开始提交修改任务，最多等 {deadline_seconds / 60:.0f} 分钟 (ง •_•)ง")

    # ---- 阶段一：提交任务（429/5xx 指数退避） ----
    resp = _request_with_retry("POST", url, deadline, headers,
                               json_body=payload)
    submitted = _parse_json(resp)

    # ---- 判断模式 ----
    task_id = _find_task_id(submitted)
    status = _find_status(submitted)
    async_mode = (mode == "async"
                  or (mode == "auto" and task_id is not None
                      and status is not None and not _has_result(submitted)))

    if not async_mode:
        print("修改成功 ✨")
        return _extract_result(submitted) if _has_result(submitted) else submitted

    # ---- 阶段二：异步轮询（每 5~15 秒一次，温和） ----
    status_url = STATUS_URL_TEMPLATE.format(base=url.rstrip("/"),
                                            task_id=task_id)
    print(f"已提交异步任务，task_id={task_id}")
    print(f"轮询地址：{status_url}（每 {POLL_INTERVAL_RANGE[0]:.0f}~"
          f"{POLL_INTERVAL_RANGE[1]:.0f}s 查一次，最多等 "
          f"{deadline_seconds / 60:.0f} 分钟）")

    first_poll = True
    while _now() < deadline:
        if not first_poll:
            remaining = deadline - _now()
            if remaining <= 0:
                break
            interval = random.uniform(*POLL_INTERVAL_RANGE)
            wait = min(interval, remaining)
            print(f"  等 {wait:.1f}s 后查询任务状态…")
            _sleep_safely(wait)
            if _now() >= deadline:
                break
        first_poll = False

        if STATUS_METHOD.upper() == "POST":
            status_body = dict(payload)
            status_body.update({"task_id": task_id})
            j = _parse_json(_request_with_retry(
                "POST", status_url, deadline, headers, json_body=status_body))
        else:
            j = _parse_json(_request_with_retry(
                "GET", status_url, deadline, headers))

        st = _find_status(j)
        st_l = str(st or "").lower()
        if st_l in DONE_STATUSES:
            print("修改完成 ✨")
            return _extract_result(j)
        if st_l in FAILED_STATUSES:
            err = j.get("error") or j.get("message") if isinstance(j, dict) else None
            raise ApiTaskError(f"任务失败：{st} {err or ''}".strip())
        if st_l not in PENDING_STATUSES:
            print(f"  ⚠ 未识别的状态值：{st!r}，继续轮询；"
                  f"可在 DONE_STATUSES / PENDING_STATUSES / FAILED_STATUSES 里补充")

    raise DeadlineExceeded(f"{deadline_seconds / 60:.0f} 分钟已到，任务仍未完成")


# =====================================================================
# ⑤ 命令行入口（方便直接测试）
# =====================================================================

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="调用 AI 修改接口（稳健重试：指数退避 + 15 分钟截止）")
    parser.add_argument("text", nargs="?", help="要交给 AI 修改的原文；"
                                                "不传则从 stdin 读取")
    parser.add_argument("--deadline", type=float,
                        default=TOTAL_DEADLINE_SECONDS,
                        help="总截止时间（秒），默认 900")
    parser.add_argument("--dry-run", action="store_true",
                        help="只打印将要发送的 payload，不真正调用")
    args = parser.parse_args()

    text = args.text
    if text is None:
        text = sys.stdin.read().strip()
    if not text:
        parser.error("请提供要修改的文本（命令行参数或 stdin）")

    payload = build_payload(text)

    if args.dry_run:
        print("=== 将要发送的请求 ===")
        print(f"URL    : {API_URL}")
        print(f"Headers: {json.dumps({k: (v[:12] + '…' if k.lower() == 'authorization' else v) for k, v in HEADERS.items()}, ensure_ascii=False)}")
        print(f"Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}")
        return

    result = ai_modify_hardcore(API_URL, payload,
                                deadline_seconds=args.deadline)
    print("=" * 50)
    if isinstance(result, (dict, list)):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result)


if __name__ == "__main__":
    main()