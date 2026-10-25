import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider, T, translate, languageOf } from "../src/shared/language.js";
import { categories, serviceQuestionnaires } from "../src/shared/service-questionnaires.js";
import { spanish } from "../src/shared/spanish.js";

test("Spanish covers every service, question and selectable answer without changing domain values",()=>{
 for(const text of [...categories,...Object.values(serviceQuestionnaires).flatMap(qs=>qs.flatMap(q=>[q.label,...(q.options||[])]))]) {
  assert.ok(spanish[text],text);
  assert.equal(translate(text,"en"),text);
 }
});
test("unsupported preferences fall back to English and unknown content is preserved",()=>{
 assert.equal(languageOf("es"),"es");
 for(const value of [null,undefined,"fr",{},"ES"]) assert.equal(languageOf(value),"en");
 assert.equal(translate("Mi cocina needs repairs","es"),"Mi cocina needs repairs");
});
test("Spanish rendering translates marked UI only and preserves user content",()=>{
 const html=renderToStaticMarkup(createElement(LanguageProvider,{initialLanguage:"es",children:createElement("div",null,createElement(T,null,"Send"),createElement("p",null,"Send"))}));
 assert.ok(html.includes("Enviar"));
 assert.ok(html.includes("<p>Send</p>"));
 const english=renderToStaticMarkup(createElement(LanguageProvider,{children:createElement(T,null,"Send")}));
 assert.equal(english,"Send");
});
