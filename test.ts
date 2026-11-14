import { Graphviz } from "@hpcc-js/wasm";

const dotSource = "digraph G { Hello -> World }";

// Returns an SVG string completely asynchronously 
const svg = await Graphviz.load().then(graphviz => graphviz.layout(dotSource, "svg"));

