import { ustvariAplikacijo } from './app.js';
import { config } from './config.js';

const app = ustvariAplikacijo();

app.listen(config.PORT, () => {
  console.log(`ClubManager API posluša na http://localhost:${config.PORT}/api`);
});
