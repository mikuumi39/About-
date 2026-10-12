/**
 * 测试环境兜底：Node 26 的实验性 globalThis.localStorage（未开
 * --localstorage-file 时为 undefined）会遮蔽 jsdom 的实现，导致
 * 用例里的 window.localStorage 报 undefined。这里补齐一个内存版
 * Storage（window 与 globalThis 双侧），仅测试环境加载。
 */
function makeStorage(): Storage {
  const map = new Map<string, string>()
  const store: Storage = {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k))! : null),
    setItem: (k, v) => {
      map.set(String(k), String(v))
    },
    removeItem: (k) => {
      map.delete(String(k))
    },
    clear: () => {
      map.clear()
    },
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  return store
}

// jsdom 环境：window 上缺失则补
if (typeof window !== 'undefined') {
  let has = false
  try {
    has = window.localStorage != null
  } catch {
    has = false
  }
  if (!has) {
    Object.defineProperty(window, 'localStorage', {
      value: makeStorage(),
      configurable: true,
      writable: true,
    })
  }
}

// 裸 localStorage（应用代码直接引用）指向同一份
try {
  if (globalThis.localStorage == null) {
    const value =
      typeof window !== 'undefined' && window.localStorage != null
        ? window.localStorage
        : makeStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value,
      configurable: true,
      writable: true,
    })
  }
} catch {
  /* Node 的实验实现不可覆盖时忽略 */
}
