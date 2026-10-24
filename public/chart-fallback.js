// Chart.js CDN fallback. The primary <script> loads Chart.js from jsDelivr; if that
// fails (CDN outage, blocked network, offline), window.Chart is undefined here. Pull
// in the self-hosted copy instead so dashboards and reports still render their charts.
// Same-origin, so it is allowed under the strict CSP (script-src 'self'); document.write
// runs synchronously during initial parse, before the app scripts that use Chart.
if (!window.Chart) {
  document.write('<script src="vendor/chart.umd.min.js?v=4.4.0"><\/script>');
}
