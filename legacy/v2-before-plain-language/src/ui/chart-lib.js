// Tree-shaken Chart.js build: only the pieces the projection line chart uses.
// Imported dynamically by charts.js so it never blocks the initial page load.
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

export { Chart };
