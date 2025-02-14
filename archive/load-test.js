import http from "k6/http";
import { sleep, check, group } from "k6";
import { randomString } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";

const BASE_URL = __ENV.BASE_URL || "https://quickpizza.grafana.com";
const rating_star = Object.freeze({
  positive: 5,
  negative: 1,
});
let headers = {
  "Content-type": "application/json",
  Authorization: "token abcdef0123456789",
};

export const options = {
  stages: [
    // ramp up stage
    { duration: "5s", target: 30 },

    // load test stage
    { duration: "50s", target: 30 },

    // ramp down stage
    { duration: "5s", target: 0 },
  ],
};

export default function () {
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
    pizza_id: "",
    stars: 1,
  };

  let token = "";

  const noAuthHeader = Object.entries(headers).filter(
    ([key, value]) => key === "Content-type"
  );
  console.log(noAuthHeader);

  group("Login Page", () => {
    const user = { username: randomString(8), password: randomString(12) };

    res = http.post(`${BASE_URL}/api/users`, JSON.stringify(user), {
      headers: noAuthHeader,
    });
    console.log(user);

    check(res, {
      "Create user status code is 20": (r) => r.status === 201,
    });
    sleep(1);

    res = http.post(`${BASE_URL}/api/users/token/login`, JSON.stringify(user));

    check(res, {
      "Login user status code is 200": (r) => r.status === 200,
      "User Token received": (r) => r.json().hasOwnProperty("token"),
    });
    console.log(res.body);

    token = res.json().token;
    headers = { ...headers, Authorization: `token ${token}` };
  });

  group("Main page", () => {
    res = http.get(`${BASE_URL}/api/config`);
    check(res, {
      "Config status code is 200": (r) => r.status === 200,
    });
    sleep(1);

    res = http.get(`${BASE_URL}/api/quotes`);
    check(res, {
      "Quotes status code is 200": (r) => r.status === 200,
      "Quotes return at least 1 quote": (r) => r.json().quotes.length > 0,
    });
    sleep(1);

    console.log(headers.Authorization);

    res = http.get(
      `${BASE_URL}/api/tools`,
      {
        headers,
      },
      { cookies: headers.Authorization }
    );
    console.log(res.body);
    console.log("Cookie is: " + JSON.stringify(res.cookies));
    check(res, {
      "Tools status code is 200": (r) => r.status === 200,
      "Tools return at least 1 tool": (r) => r.json().tools.length > 0,
    });
    sleep(1);

    group("Pizza interactions", () => {
      res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(restrictions), {
        headers,
      });

      check(res, {
        "Get Pizza status code is 200": (r) => r.status === 200,
        "A Pizza is returned": (r) => r.json().hasOwnProperty("pizza"),
      });
      sleep(1);

      ratings.pizza_id = res.json().pizza.id;

      res = http.post(
        `${BASE_URL}/api/ratings`,
        JSON.stringify({ ...ratings, stars: rating_star.positive }),
        { headers }
      );
      console.log(res.status);

      check(res, {
        "Rate Pizza status code is 201": (r) => r.status === 201,
        "Pizza id is correct": (r) => r.json().pizza_id === ratings.pizza_id,
      });
      sleep(1);
    });

    group("User page", () => {
      res = http.get(`${BASE_URL}/api/ratings`, { headers });

      check(res, {
        "Get ratings status code is 200": (r) => r.status === 200,
      });
      sleep(1);

      res = http.del(`${BASE_URL}/api/ratings`, null, { headers: headers });

      check(res, {
        "Clear ratings status code is 204": (r) => r.status === 204,
      });
      sleep(1);
    });
  });
}
