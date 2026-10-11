# Tutorial 1 (Week 9) Sets & probability

Interactive exercises for all seven questions in Tutorial Set 1, using the CE2134 teaching-page style. The instructor's Tutorial 1 selection is Q1, Q2, Q3 and Q5.

Prof. Gary’s AI Proxy uses the same chat layout as the hydrostatic-pressure lab and follows the selected question, current inputs, and conversation.

Live web service: [ce2407a-tutorial1.onrender.com](https://ce2407a-tutorial1.onrender.com). The GitHub Pages and local copies use this service for chat.

Link to a specific question with `?question=q3`. For slides on GitHub Pages, embed `https://jiaruilei.github.io/CE2407A_Tutorial1/?question=q3&embed=1`; this hides the repeated page header and tabs while keeping the exercise and AI chat. Replace `q3` with any question from `q1` to `q7`.

Run locally with Node.js 22 or 24:

```sh
npm ci
npm start
```

Open `http://localhost:3000`. Set `OPENAI_API_KEY` in the server environment to enable chat. The tutor uses `gpt-6.1-sol` through the OpenAI Responses API, with `low` reasoning effort and a 2,048-token budget for reasoning and output. Answers stay concise through the tutor instructions. Requests use `store: false` and a 55-second timeout. See `.env.example` for optional overrides and limits. Never place the key in HTML or browser JavaScript.

For Render, create a Node web service from this repository’s `main` branch, with `npm ci` as the build command and `npm start` as the start command. Set `OPENAI_API_KEY` in Render’s environment settings. The server listens on `0.0.0.0:$PORT`; `/health` reports whether chat is configured.

The exercises and bundled MathJax also work by opening `index.html` locally. API chat needs the web service. A `tutorial-api-base` meta tag can point a GitHub Pages copy to the Render service; the server allows only the configured Pages origin and its own origin.

Formulas use the bundled MathJax 3.2.2 TeX-to-SVG package, including dynamic results and working. Plain-text formulas remain available if rendering cannot load. The original package and Apache 2.0 license are in `assets/mathjax`; source: [MathJax package](https://www.npmjs.com/package/mathjax/v/3.2.2).

Run the calculation and interaction checks with Node.js:

```sh
npm test
```

Q1 includes all eight directed routes and both travel-time exercises. Q5 uses the original pavement plot and the supplied solution counts. Q6 normalises occurrence rates without rounding intermediate values.

Q3 uses the exact `P(U) = 0.10018`; Q4 recognises the equal contributions of A and C (`0.072` each).

Chat requests include only the selected question, current exercise values, and recent messages. Conversation histories are separate per question and kept in browser memory. The server provides verified tutorial context to the OpenAI Responses API with `store: false`, validates input, bounds response length, and applies request limits. Provider failures produce a visible unavailable message. Static serving uses an explicit file list, so server configuration and environment files are not served.
