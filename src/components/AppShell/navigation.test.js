import {
  filterVisibleNavigationItems,
  isNavigationItemActive,
} from "./navigation";

describe("AppShell navigation", () => {
  it("remove o módulo quando ele ou todos os seus submenus estão indisponíveis", () => {
    const hiddenParent = {
      key: "hidden-parent",
      matchPaths: ["/hidden"],
      isVisible: () => false,
      children: [{ key: "child", matchPaths: ["/hidden/child"] }],
    };
    const hiddenChildren = {
      key: "hidden-children",
      matchPaths: ["/children"],
      children: [{
        key: "child",
        matchPaths: ["/children/child"],
        isVisible: () => false,
      }],
    };

    expect(filterVisibleNavigationItems([hiddenParent, hiddenChildren])).toEqual([]);
  });

  it("mantém somente os submenus permitidos e deriva o pai ativo da rota filha", () => {
    const item = {
      key: "module",
      matchPaths: ["/module"],
      children: [
        { key: "allowed", matchPaths: ["/module/allowed"] },
        {
          key: "hidden",
          matchPaths: ["/module/hidden"],
          isVisible: () => false,
        },
      ],
    };

    const [visibleItem] = filterVisibleNavigationItems([item]);
    expect(visibleItem.children).toHaveLength(1);
    expect(isNavigationItemActive(visibleItem, "/module/allowed")).toBe(true);
  });
});
