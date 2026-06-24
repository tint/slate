export type Range = {
  start: number;
  end: number;
};

export type Position = {
  line: number;
  character: number;
};

export class LineMap {
  readonly source: string;
  readonly lineStarts: number[];

  constructor(source: string) {
    this.source = source;
    this.lineStarts = [0];

    for (let index = 0; index < source.length; index++) {
      const char = source.charCodeAt(index);

      if (char === 10) {
        this.lineStarts.push(index + 1);
      }
    }
  }

  positionAt(offset: number): Position {
    const safeOffset = Math.max(0, Math.min(offset, this.source.length));
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const lineStart = this.lineStarts[mid]!;

      if (lineStart > safeOffset) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const line = Math.max(0, low - 1);
    return {
      line,
      character: safeOffset - this.lineStarts[line]!,
    };
  }
}
