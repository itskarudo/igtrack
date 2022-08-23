import { Command } from "@oclif/core";
import * as puppeteer from "puppeteer";
import * as fs from "fs-extra";
import * as path from "path";
import { ConfigType } from "../config";
import { compareFollowers } from "../utils";
import { red, green, bold, yellow } from "colorette";

export default class Scan extends Command {
  static description = "Scan the current account followers";

  public async run(): Promise<void> {
    const configPath = path.join(this.config.configDir, "config.json");
    const loggedIn = fs.existsSync(configPath);

    if (!loggedIn) this.error(bold(red("You are not logged in")));

    const { username, password, followers }: ConfigType = await fs.readJSON(
      configPath
    );

    if (!username || !password)
      this.error(
        bold(red("Your config file is corrupted, please log in again"))
      );

    if (!followers)
      this.log(
        yellow("This is the first scan, your followers will be cached.")
      );

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://instagram.com");

    await page.waitForSelector("input[name=username]");

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

    if (error) {
      await browser.close();
      this.error(
        bold(red("Your config file is corrupted, please log in again"))
      );
    }

    await page.goto(`https://instagram.com/${username}/followers`);
    await page.waitForSelector("._ac2a");

    const newFollowers = await page.evaluate(() => {
      return new Promise<string[]>((resolve, _) => {
        let followers: Element[] = [];

        const int = setInterval(() => {
          followers = Array.from(
            document.getElementsByClassName(
              "_ab8w  _ab94 _ab97 _ab9f _ab9k _ab9p  _ab9- _aba8 _abcm"
            )
          );
          followers.at(-1)?.scrollIntoView();

          if (document.querySelector("._aano")?.children.length == 1) {
            clearInterval(int);
            resolve(
              followers.map(
                (f) =>
                  f.getElementsByClassName(
                    "_ab8y  _ab94 _ab97 _ab9f _ab9k _ab9p _abcm"
                  )[0].innerHTML
              )
            );
          }
        }, 100);
      });
    });

    if (followers) {
      const { newFollows, unfollowed } = compareFollowers(
        followers,
        newFollowers
      );

      if (!newFollows.length && !unfollowed.length) {
        this.log(bold(yellow("No changes since last scan.")));
        return;
      }

      if (newFollows.length) {
        this.log(bold(green("New Followers:")));
        for (let f of newFollows) this.log(f);
      }

      if (unfollowed.length) {
        this.log(bold(red("Unfollowers:")));
        for (let f of unfollowed) this.log(f);
      }
    }

    await browser.close();

    await fs.writeJSON(configPath, {
      username,
      password,
      followers: newFollowers,
    });
  }
}
