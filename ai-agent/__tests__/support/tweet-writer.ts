import fs from "fs/promises";
import path from "path";

export class TweetWriter {
  private static outputFile = path.join(
    process.cwd(),
    "outputs",
    "tweet-gen.md"
  );
  private static isCleared = false;

  /**
   * Clear the output file at the beginning of test run
   */
  static async clearOutputFile(): Promise<void> {
    try {
      // Ensure directory exists
      const outputDir = path.dirname(this.outputFile);

      try {
        await fs.access(outputDir);
      } catch {
        await fs.mkdir(outputDir, { recursive: true });
      }

      // await fs.mkdir(outputDir, { recursive: true });

      await fs.writeFile(this.outputFile, "");
      this.isCleared = true;
      console.log(`Output file cleared: ${this.outputFile}`);
    } catch (error) {
      console.error("Error clearing output file:", error);
    }
  }

  /**
   * Write tweet content to the output file
   */
  static async writeTweet(title: string, content: any): Promise<void> {
    // Clear file on first write if not already cleared
    if (!this.isCleared) {
      await this.clearOutputFile();
    }

    const timestamp = new Date().toISOString();
    const separator = "\n---\n";

    let output = `## ${title} - ${timestamp}\n\n`;

    if (typeof content === "object") {
      output += "```json\n" + JSON.stringify(content, null, 2) + "\n```\n";
    } else {
      output += content.toString() + "\n";
    }

    output += separator;

    try {
      // Ensure directory exists before writing
      const outputDir = path.dirname(this.outputFile);
      await fs.mkdir(outputDir, { recursive: true });

      await fs.appendFile(this.outputFile, output);
      console.log(`Tweet written to ${this.outputFile}`);
    } catch (error) {
      console.error("Error writing tweet:", error);
    }
  }

  /**
   * Reset the cleared flag (useful for testing)
   */
  static resetClearedFlag(): void {
    this.isCleared = false;
  }
}
