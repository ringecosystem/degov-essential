import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { EnsClient } from "../internal/ens";
import { MixedAccountInfo } from "../types";

@Service()
export class ProfileService {
  constructor(
    private readonly ensClient: EnsClient
  ) {
  }

  async mixedAccountInfo(fastify: FastifyInstance, options: QueryXAccountOptions): Promise<MixedAccountInfo> {
    const prisma = fastify.prisma;

    // await prisma.ens_text_record

    // {"code":0,"data":{"id":"607416664589340672","address":"0x3e8436e87abb49efe1a958ee73fbb7a12b419aab","power":"0x0000000000000000000000000000000000000000000003d13ee17cdc4ecc0000","name":"Bear Play 01","email":"boundless.forest@outlook.com","twitter":"boundless4orest","github":"boundless-forest","discord":"729620885702443048","telegram":"boundless_forest","medium":"","delegate_statement":"As a active member of the Degov.AI ecosystem, I am committed to contributing to the development of this product. I will actively participate in discussions, provide feedback, and share my insights to help shape the future of Degov.AI. I believe in the importance of collaboration and transparency, and I will work to ensure that all voices are heard and considered in the decision-making process.","additional":"","last_login_time":"2025-07-22T05:39:05.137Z","ctime":"2025-03-19T15:37:11.109Z","utime":"2025-07-22T05:39:07.302Z","dao_code":"degov-demo-dao","avatar":"data:image/jpeg;base64,/9j/4AAQSkZJRg"}}
  }
}

export interface QueryXAccountOptions {
  degovSite: string;
  address: string;
}

