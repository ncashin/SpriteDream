import "./main";

if (import.meta.hot) {
  import.meta.hot.accept("./main", () => {
    import("./main");
  });
}
