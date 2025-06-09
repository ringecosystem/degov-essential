import { InlineErrorV2 } from "twitter-api-v2";

export class McpCommon {
  static defaultToolErrorMessage(error: any): string {
    console.error("Error in tool:", error);
    let output = error instanceof Error ? error.message : "Unknown error";
    if ("data" in error) {
      const data = error.data;
      const status = data.status;
      if (status === 429) {
        const rateLimit = error.rateLimit;
        output += ` -> You just hit the rate limit! [limit]: ${
          rateLimit?.limit
        }, [remaining]: ${rateLimit?.remaining}, [reset]: ${new Date(
          rateLimit?.reset * 1000
        ).toISOString()}`;
      }
      if (status) {
        output = `[${status}]: ${output}`;
      }
    }
    if ("errors" in error && error.errors) {
      output = `${output}\nErrors: ${JSON.stringify(error.errors)}`;
    }
    return output;
  }

  static stdTwitterError(
    errors: InlineErrorV2[] | undefined
  ): string | undefined {
    if (!errors || errors.length === 0) {
      return;
    }
    return errors
      .map(
        (error) =>
          `[${error.type}]: ${error.title} - ${error.detail} ${error.reason}`
      )
      .join("\n");
  }
}
