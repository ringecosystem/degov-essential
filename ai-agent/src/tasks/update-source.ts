import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { DegovAgentSource } from "../internal/agent-source";

@Service()
export class DegovUpdateSourceTask {
  constructor(private readonly degovAgentSource: DegovAgentSource) {}
  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-update-source", async () => {
      try {
        await this.degovAgentSource.refresh(fastify);
        fastify.log.info(
          `[task-update-source] Successfully refreshed degov agent source`
        );
      } catch (err) {
        fastify.log.error(err);
      }
    });
    const job = new SimpleIntervalJob(
      {
        minutes: 10,
        runImmediately: false,
      },
      task
    );
    fastify.ready().then(() => {
      fastify.scheduler.addSimpleIntervalJob(job);
    });
  }
}
