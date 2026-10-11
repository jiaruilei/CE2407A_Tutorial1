# CE2407A · Tutorial 1

Interactive exercises for all seven questions in Tutorial Set 1, using the CE2134 teaching-page style. The instructor's Tutorial 1 selection is Q1, Q2, Q3 and Q5.

Open `index.html` in a browser. Keep the JavaScript files, `styles.css` and `assets` folder beside it. No build step or network connection is needed.

Formulas use the bundled MathJax 3.2.2 TeX-to-SVG package, including dynamic results and working. Plain-text formulas remain available if rendering cannot load. The original package and Apache 2.0 license are in `assets/mathjax`; source: [MathJax package](https://www.npmjs.com/package/mathjax/v/3.2.2).

Run the calculation and interaction checks with Node.js:

```sh
node --test tests/*.test.cjs
```

Q1 includes all eight directed routes and both travel-time exercises. Q5 uses the original pavement plot and the supplied solution counts. Q6 normalises occurrence rates without rounding intermediate values.

Q3 uses the exact `P(U) = 0.10018`; Q4 recognises the equal contributions of A and C (`0.072` each). Hints are local, rule-based responses.
