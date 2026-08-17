import fs from "fs";
import path from "path";

const drawerSource = fs.readFileSync(path.resolve(__dirname, "index.js"), "utf8");

describe("AppDrawer layout structure", () => {
  it("aligns the drawer and backdrop directly below the AppShell header", () => {
    expect(drawerSource).not.toContain("layout.topbarHeight");
    expect(drawerSource.match(/layout\.appHeaderHeight/g)).toHaveLength(3);
  });
});
