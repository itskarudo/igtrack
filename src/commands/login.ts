import { Command, CliUx } from "@oclif/core";
import * as puppeteer from "puppeteer";
import * as fs from "fs-extra";
import * as path from "path";
import { bold, green, red } from "colorette";

export default class Login extends Command {
  static description = "Log into your account";

  public async run(): Promise<void> {
    const username = await CliUx.ux.prompt("Your username");
    const password = await CliUx.ux.prompt("Your password", { type: "hide" });

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto("https://instagram.com");

    await page.waitForSelector("input[name=username]");

    /**
     * escape the cookies prompt,
     * god i'm tired of this website
     */

    const cookies = await page.$(".aOOlW.HoLwm");

    if (cookies) {
      await cookies.click();
      await page.waitForFunction(`!document.querySelector('.aOOlW.HoLwm')`);
    }

    await page.type("input[name=username]", username);
    await page.type("input[name=password]", password);
    await page.click("button[type=submit]");

    await Promise.any([
      page.waitForSelector("[type=submit]:not(:disabled)"),
      page.waitForNavigation(),
    ]);

    const error = !!(await page.$("#slfErrorAlert"));
    if (error) this.error(bold(red("Incorrect credentials, please try again")));

    const configPath = path.join(this.config.configDir, "config.json");

    await fs.ensureFile(configPath);

    await fs.writeJSON(configPath, {
      username,
      password,
    });

    await browser.close();
    this.log(bold(green("Logged in successfully!")));
  }
}
