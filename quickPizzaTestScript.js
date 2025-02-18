import http from 'k6/http';
import {sleep, check, group} from 'k6';
import exec from 'k6/execution';
import {randomString} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import {htmlReport} from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {SmokeOptions, AverageStages, StressStages, SpikeStages} from './load-options.js';

const BASE_URL = __ENV.BASE_URL || 'https://quickpizza.grafana.com';
const rating_star = Object.freeze({
  positive: 5,
  negative: 1,
});
const sleepDurationBetweenStages = 10;
/* PROBLEM SOLVING STEPS
Step 1: use map to change array of { duration: ..., target: ...} to array of { 5s, 10s, 5s}
Step 2: Turn array of duration strings into number string using substring: { 5s, 10s, 5s} => {5,10,5}
Step 3: Parse duration from string to number using Number 
Step 4: use Reduce to sum all values in the duration (int) array
*/
const averageLoadDuration = AverageStages.map(({duration, target}) => Number(duration.substring(0, duration.length - 1)) + sleepDurationBetweenStages).reduce(
  (accumulator, currentValue) => accumulator + currentValue
);
const stressLoadDuration =
  StressStages.map(({duration, target}) => Number(duration.substring(0, duration.length - 1))).reduce((accumulator, currentValue) => accumulator + currentValue) +
  averageLoadDuration +
  sleepDurationBetweenStages;

export const options = {
  // For more info on Scenarios config, refer to this link https://grafana.com/docs/k6/latest/using-k6/scenarios/
  // Advanced usage of scenarios can be found here https://grafana.com/docs/k6/latest/using-k6/scenarios/advanced-examples/
  scenarios: {
    smoke: {
      exec: 'pizzaUserFlow',
      executor: 'constant-vus',
      tags: {stage: 'smoke'},
      vus: SmokeOptions.vus,
      duration: SmokeOptions.duration,
      env: {MYVAR: 'smoke'},
    },
    load: {
      exec: 'pizzaUserFlow',
      executor: 'ramping-vus',
      stages: AverageStages,
      tags: {stage: 'load'},
      startTime: SmokeOptions.duration,
    },
    stress: {
      exec: 'pizzaUserFlow',
      executor: 'ramping-vus',
      stages: StressStages,
      tags: {stage: 'stress'},
      startTime: `${averageLoadDuration}s`,
    },
    spike: {
      exec: 'pizzaUserFlow',
      executor: 'ramping-vus',
      stages: SpikeStages,
      tags: {stage: 'spike'},
      startTime: `${stressLoadDuration}s`,
    },
  },
  // For more info on how to set up thresholds, refer to this link https://grafana.com/docs/k6/latest/using-k6/thresholds/
  thresholds: {
    checks: ['rate >= 0.95'],
    'checks{stage:smoke}': [{threshold: 'rate == 1', abortOnFail: true}],
    'checks{stage:load}': [{threshold: 'rate >= 0.99'}],
    'checks{stage:stress}': [{threshold: 'rate >= 0.95'}],
    'checks{stage:spike}': [{threshold: 'rate >= 0.9'}],
    http_req_duration: ['p(95) < 3000'],
    // Latency < 1s / 1.5s
    'http_req_duration{stage:smoke}': [{threshold: 'p(95) < 1000'}],
    'http_req_duration{stage:load}': [{threshold: 'p(95) < 1000'}],
    'http_req_duration{stage:stress}': [{threshold: 'p(95) < 1000'}],
    'http_req_duration{stage:spike}': [{threshold: 'p(95) < 1500'}],
    http_reqs: [{threshold: 'rate > 0.1'}],
    // Number of request the service can handle per second
    'http_reqs{stage:smoke}': [{threshold: 'rate > 0.05'}],
    'http_reqs{stage:load}': [{threshold: 'rate > 0.2'}],
    'http_reqs{stage:stress}': [{threshold: 'rate > 1'}],
    'http_reqs{stage:spike}': [{threshold: 'rate > 3'}],
    http_req_failed: [{threshold: 'rate < 0.05'}],
    'http_req_failed{stage:smoke}': [{threshold: 'rate == 0'}],
    // Availability - 95%
    'http_req_failed{stage:load}': [{threshold: 'rate < 0.05'}],
    'http_req_failed{stage:stress}': [{threshold: 'rate < 0.05'}],
    'http_req_failed{stage:spike}': [{threshold: 'rate < 0.05'}],
  },
};

export function pizzaUserFlow() {
  // For more use cases of exec context variables, refer to this link: https://grafana.com/docs/k6/latest/using-k6/execution-context-variables/
  // console.log("Stage: " + exec.scenario.name);

  let headers = {
    'Content-type': 'application/json',
    Authorization: 'token abcdef0123456789',
  };
  let res = null;
  let restrictions = {
    maxCaloriesPerSlice: 1000,
    mustBeVegetarian: false,
    excludedIngredients: [],
    excludedTools: [],
    maxNumberOfToppings: 5,
    minNumberOfToppings: 2,
  };

  let ratings = {
    pizza_id: '',
    stars: 1,
  };

  let token = '';

  const noAuthHeader = Object.entries(headers).filter(([key, value]) => key === 'Content-type');

  group('Login Page', () => {
    const user = {username: randomString(8), password: randomString(12)};

    res = http.post(`${BASE_URL}/api/users`, JSON.stringify(user), {
      headers: noAuthHeader,
    });

    check(res, {
      'Create user status code is 201': (r) => r.status === 201,
    });
    sleep(1);

    res = http.post(`${BASE_URL}/api/users/token/login`, JSON.stringify(user));

    check(res, {
      'Login user status code is 200': (r) => r.status === 200,
      'User Token received': (r) => r.json().hasOwnProperty('token'),
    });

    token = res.json().token;
    headers = {...headers, Authorization: `token ${token}`};
  });

  group('Main page', () => {
    res = http.get(`${BASE_URL}/api/config`);
    check(res, {
      'Config status code is 200': (r) => r.status === 200,
    });
    sleep(1);

    res = http.get(`${BASE_URL}/api/quotes`);
    check(res, {
      'Quotes status code is 200': (r) => r.status === 200,
      'Quotes return at least 1 quote': (r) => r.json().quotes.length > 0,
    });
    sleep(1);

    res = http.get(`${BASE_URL}/api/tools`, {
      headers,
    });
    const toolsLength = res.status === 200 ? res.json().tools.length : 0;

    check(res, {
      'Tools status code is 200': (r) => r.status === 200,
      'Tools return at least 1 tool': (r) => toolsLength > 0,
    });
    sleep(1);

    group('Pizza interactions', () => {
      res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
        headers,
      });

      check(res, {
        'Get Pizza status code is 200': (r) => r.status === 200,
        'A Pizza is returned': (r) => r.json().hasOwnProperty('pizza'),
      });
      sleep(1);

      ratings.pizza_id = res.status === 200 ? res.json().pizza.id : null;

      res = http.post(`${BASE_URL}/api/ratings`, JSON.stringify({...ratings, stars: rating_star.positive}), {headers});

      check(res, {
        'Rate Pizza status code is 201': (r) => r.status === 201,
        'Pizza id is correct': (r) => r.json().pizza_id === ratings.pizza_id,
      });
      sleep(1);
    });

    group('User page', () => {
      res = http.get(`${BASE_URL}/api/ratings`, {headers});

      check(res, {
        'Get ratings status code is 200': (r) => r.status === 200,
      });
      sleep(1);

      res = http.del(`${BASE_URL}/api/ratings`, null, {headers: headers});

      check(res, {
        'Clear ratings status code is 204': (r) => r.status === 204,
      });
      sleep(1);
    });
  });
}

// export function handleSummary(data) {
//   return {
//     "summary.html": htmlReport(data),
//   };
// }

/* Interpreting end-of-test summary report - https://github.com/grafana/k6-learn/blob/main/Modules/II-k6-Foundations/03-Understanding-k6-results.md
    execution: local
    script: .\quickPizzaTestScript.js
    output: - => This indicates the default behavior, other behavior can be found here https://grafana.com/docs/k6/latest/get-started/results-output/
 */
