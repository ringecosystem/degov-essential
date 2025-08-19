import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { EnsClient } from "../internal/ens";
import { MixedAccountInfo } from "../types";

@Service()
export class ProfileService {
  constructor(private readonly ensClient: EnsClient) {}

  async mixedAccountInfo(
    fastify: FastifyInstance,
    options: QueryXAccountOptions
  ): Promise<MixedAccountInfo | undefined> {
    const prisma = fastify.prisma;
    // Check if there is a cached record
    const cachedRecord = await prisma.ens_record.findFirst({
      where: {
        address: options.address,
      },
      include: {
        ens_text_records: true,
      },
      orderBy: {
        utime: "desc",
      },
    });

    // If there is a cached record, return it
    if (cachedRecord) {
      const twitterRecord = cachedRecord.ens_text_records.find(
        (record) =>
          record.key === "com.twitter" || record.key === "social.twitter"
      );

      if (twitterRecord?.value || cachedRecord.ens_name) {
        return {
          ensName: cachedRecord.ens_name,
          xUsername: twitterRecord?.value || undefined,
        };
      }
    }

    // Call DeGov API to query user profile
    try {
      const response = await fetch(
        `${options.degovSite}/api/profile/${options.address}`
      );
      if (response.ok) {
        const apiData = await response.json();
        if (apiData.code === 0 && apiData.data) {
          const { twitter, name } = apiData.data;

          if (twitter || name) {
            // Save to database
            await this.saveToEnsRecords(fastify, {
              address: options.address,
              ensName: name,
              xUsername: twitter,
            });

            return {
              ensName: name,
              xUsername: twitter,
            };
          }
        }
      }
    } catch (error) {
      fastify.log.warn(`Failed to fetch profile from DeGov API: ${error}`);
    }

    // If DeGov API did not return data, call ENS client
    try {
      const ensResult = await this.ensClient.findTwitterUsername(
        options.address as any
      );

      // Currently only data for twitter username is saved
      if (ensResult.code === 0 && ensResult.ensname && ensResult.username) {
        // Save to database
        await this.saveToEnsRecords(fastify, {
          address: options.address,
          ensName: ensResult.ensname,
          xUsername: ensResult.username,
        });

        return {
          ensName: ensResult.ensname,
          xUsername: ensResult.username,
        };
      }
    } catch (error) {
      fastify.log.warn(`Failed to fetch ENS profile: ${error}`);
    }

    return undefined;
  }

  private async saveToEnsRecords(
    fastify: FastifyInstance,
    options: {
      address: string;
      ensName?: string;
      xUsername?: string;
    }
  ) {
    const prisma = fastify.prisma;
    const { address, ensName, xUsername } = options;
    if (!ensName) {
      return;
    }

    // save or update ens_record
    const ensRecord = await prisma.ens_record.upsert({
      where: {
        address_ens_name: {
          address: address,
          ens_name: ensName,
        },
      },
      update: {
        utime: new Date(),
      },
      create: {
        id: fastify.snowflake.generate(),
        address: address,
        ens_name: ensName || "unknown",
        is_primary: true,
      },
    });

    // if have twitter, save to ens_text_record
    if (xUsername) {
      await prisma.ens_text_record.upsert({
        where: {
          ens_record_id_key: {
            ens_record_id: ensRecord.id,
            key: "com.twitter",
          },
        },
        update: {
          value: xUsername,
          utime: new Date(),
        },
        create: {
          id: fastify.snowflake.generate(),
          ens_record_id: ensRecord.id,
          key: "com.twitter",
          value: xUsername,
        },
      });
    }
  }
}

export interface QueryXAccountOptions {
  degovSite: string;
  address: string;
}
