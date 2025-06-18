import { Service } from "typedi";
import { DegovDaoConfig } from "../types";
import axios from "axios";

@Service()
export class DegovAgentSource {
  private daos: DegovDaoConfig[] = [];

  async refresh(): Promise<void> {
    axios.get('')
  }
}
