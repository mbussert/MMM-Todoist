"use strict";

/* Magic Mirror
 * Module: MMM-Todoist
 *
 * By Chris Brooker
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const request = require("request");
const showdown = require("showdown");

const markdown = new showdown.Converter();

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node helper for: " + this.name);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "FETCH_TODOIST") {
      this.config = payload;
      this.fetchTodos();
    } else if (notification === "COMPLETE_TODO") {
      this.completeTodo(payload);
    }
  },

  fetchTodos: function () {
    var self = this;
    //request.debug = true;
    var acessCode = self.config.accessToken;
    request(
      {
        url:
          self.config.apiBase +
          "/" +
          self.config.apiVersion +
          "/" +
          self.config.todoistEndpoint,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "cache-control": "no-cache",
          Authorization: "Bearer " + acessCode,
        },
        form: {
          sync_token: "*",
          resource_types: self.config.todoistResourceType,
        },
      },
      function (error, response, body) {
        if (error) {
          self.sendSocketNotification("FETCH_ERROR", {
            error: error,
          });
          return console.error(" ERROR - MMM-Todoist: " + error);
        }
        if (self.config.debug) {
          console.log(body);
        }
        if (response.statusCode === 200) {
          var taskJson = JSON.parse(body);
          taskJson.items.forEach((item) => {
            item.contentHtml = markdown.makeHtml(item.content);
          });

          taskJson.accessToken = acessCode;
          self.sendSocketNotification("TASKS", taskJson);
        } else {
          console.log("Todoist api request status=" + response.statusCode);
        }
      }
    );
  },

  completeTodo: function (payload) {
    var self = this;
    var accessToken = payload.accessToken;
    var itemId = payload.itemId;

    // Generate a UUID for the command
    var uuid = this.generateUUID();

    // Get current date in ISO format
    var dateCompleted = new Date().toISOString();

    request(
      {
        url:
          self.config.apiBase +
          "/" +
          self.config.apiVersion +
          "/" +
          self.config.todoistEndpoint,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "cache-control": "no-cache",
          Authorization: "Bearer " + accessToken,
        },
        form: {
          commands: JSON.stringify([
            {
              type: "item_complete",
              uuid: uuid,
              args: {
                id: itemId,
                date_completed: dateCompleted,
              },
            },
          ]),
        },
      },
      function (error, response, body) {
        if (error) {
          console.error("ERROR - MMM-Todoist completeTodo: " + error);
          return;
        }

        if (response.statusCode === 200) {
          console.log("Todo completed successfully: " + itemId);
          // Refresh the todos after completion
          self.fetchTodos();
        } else {
          console.log(
            "Todoist completeTodo api request status=" + response.statusCode
          );
          console.log("Response body:", body);
        }
      }
    );
  },

  generateUUID: function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  },
});
