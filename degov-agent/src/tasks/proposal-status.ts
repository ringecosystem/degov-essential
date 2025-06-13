import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";

@Service()
export class DegovProposalStatusTask {
  constructor() {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-proposal-status", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_TASK_PROPOSAL_STATUS",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_TASK_PROPOSAL_STATUS is disabled, skipping task."
          );
          return;
        }

        await this.run(fastify);
      } catch (err) {
        fastify.log.error(err);
      }
    });
    const job = new SimpleIntervalJob(
      {
        minutes: 3,
        runImmediately: true,
      },
      task
    );
    fastify.ready().then(() => {
      fastify.scheduler.addSimpleIntervalJob(job);
    });
  }

  private async run(fastify: FastifyInstance) {}
}
