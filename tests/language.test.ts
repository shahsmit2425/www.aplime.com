import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {LanguageProvider,T,translate} from "../src/shared/language.js";
test("interface renders in English and preserves user-written content",()=>{
 const html=renderToStaticMarkup(createElement(LanguageProvider,{children:createElement("div",null,createElement(T,null,"Send"),createElement("p",null,"Mi cocina needs repairs"))}));
 assert.ok(html.includes("Send"));
 assert.ok(!html.includes("Enviar"));
 assert.ok(html.includes("Mi cocina needs repairs"));
 assert.equal(translate("Dashboard"),"Dashboard");
});
