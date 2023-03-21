import { Command, CliUx } from "@oclif/core";
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

    await Promise.any([
      page.waitForSelector("input[name=verificationCode]"),
      page.waitForNetworkIdle(),
    ]);

    const tfa = await page.$("input[name=verificationCode]");
    if (tfa) {
      const code = await CliUx.ux.prompt("Enter OTP");
      await tfa.type(code);
      await page.click("._acan._acap._acas._aj1-");
      await page.waitForNavigation();
    }

    await page.goto(`https://instagram.com/${username}/followers`);
    await page.waitForSelector("._aano");
    await page.waitForFunction("document.querySelector('._aano').children.length > 2");
    await page.waitForFunction("document.querySelector('._aano').children.length <= 2");

    const newFollowers = await page.evaluate(() => {
      return new Promise<string[]>((resolve, _) => {
        let followers: Element[] = [];

        const int = setInterval(() => {
          followers = Array.from(
            document.getElementsByClassName(
              "x1i10hfl x1qjc9v5 xjbqb8w xjqpnuy xa49m3k xqeqjp1 x2hbi6w x13fuv20 xu3j5b3 x1q0q8m5 x26u7qi x972fbf xcfux6l x1qhh985 xm0m39n x9f619 x1ypdohk xdl72j9 x2lah0s xe8uvvx xdj266r x11i5rnm xat24cr x1mh8g0r x2lwn1j xeuugli xexx8yu x4uap5 x18d9i69 xkhd6sd x1n2onr6 x16tdsg8 x1hl2dhg xggy1nq x1ja2u2z x1t137rt x1q0g3np x87ps6o x1lku1pv x1a2a7pz xh8yej3 x193iq5w x1lliihq x1dm5mii x16mil14 xiojian x1yutycm"
            )
          );
          followers.at(-1)?.scrollIntoView();

          if (document.querySelector("._aano")?.children.length == 1) {
            clearInterval(int);
            resolve(
              followers.map(
                (f) =>
                  f.getElementsByClassName(
                    "x9f619 xjbqb8w x1rg5ohu x168nmei x13lgxp2 x5pf9jr xo71vjh x1n2onr6 x1plvlek xryxfnj x1c4vz4f x2lah0s x1q0g3np xqjyukv x6s0dn4 x1oa3qoh x1nhvcw1"
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
        await browser.close();
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
