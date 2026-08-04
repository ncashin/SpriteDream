if (location.pathname.startsWith("/game")) {
  import("./game");
} else {
  import("./style.css");
  import("./editor");
}
