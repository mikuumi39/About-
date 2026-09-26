/** 引擎统一错误：携带可选的输入位置（用于界面定位标记） */
export class CalcError extends Error {
  readonly pos?: number
  constructor(message: string, pos?: number) {
    super(message)
    this.name = 'CalcError'
    this.pos = pos
  }
}
