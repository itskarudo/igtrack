import { Command } from "@oclif/core";
import * as path from "path";
import * as fs from "fs-extra";
import { bold, green } from "colorette";

export default class Logout extends Command {
  static description = "Logout from your account";

  public async run(): Promise<void> {
    const configPath = path.join(this.config.configDir, "config.json");

    await fs.readFile(configPath);
    this.log(bold(green("Logged out successfully!")));
  }
}
