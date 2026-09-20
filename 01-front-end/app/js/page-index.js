/* index.html — the public landing page.

   This file exists because our Content Security Policy is script-src 'self':
   an inline <script> in the page would simply not run. Every page has one of
   these, named after the page. */

(function () {
  // Public page: render the header for whoever is (or is not) signed in.
  Data.getCurrentUser().then(function (user) {
    renderHeader(user);
    renderFooter();
  }).catch(function () {
    // A landing page must render even if the session check fails.
    renderHeader(null);
    renderFooter();
  });

  var list = $('#agent-tags');
  if (list) {
    clear(list);
    AGENTS.forEach(function (a) {
      var li = document.createElement('li');
      var tag = el('span', 'tag', a.name);
      tag.title = a.role;
      li.appendChild(tag);
      list.appendChild(li);
    });
  }
})();
