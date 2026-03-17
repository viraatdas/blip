const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start() {
    this.interval = setInterval(() => {
      const frame = frames[this.frameIndex % frames.length];
      process.stderr.write(`\r${frame} ${this.message}`);
      this.frameIndex++;
    }, 80);
  }

  update(message: string) {
    this.message = message;
  }

  stop(finalMessage?: string) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stderr.write("\r" + " ".repeat(this.message.length + 4) + "\r");
    if (finalMessage) {
      console.log(finalMessage);
    }
  }
}
