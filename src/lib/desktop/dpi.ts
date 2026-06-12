export class PhysicalPosition {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  toLogical(_scaleFactor: number): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}

export class PhysicalSize {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}
}
