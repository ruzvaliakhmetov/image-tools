/*
 * Image Tools frontend
 * Copyright (C) 2026 Ruz Valiakhmetov
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Source and licence information:
 * https://github.com/ruzvaliakhmetov/image-tools/
 */

(function () {
  "use strict";

  var DEFAULT_BUTTON_LABEL = "Generate ZIP";
  var controllers = Array.prototype.map.call(
    document.querySelectorAll("[data-tool]"),
    createController
  );

  function naturalSort(a, b) {
    return a.name.localeCompare(
      b.name,
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  }

  function padNumber(number) {
    return String(number).padStart(2, "0");
  }

  function isAcceptedFile(file, acceptedTypes) {
    if (acceptedTypes.indexOf(file.type) !== -1) {
      return true;
    }

    var extension = file.name.split(".").pop().toLowerCase();
    var extensionTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp"
    };

    return Boolean(extensionTypes[extension]) &&
      acceptedTypes.indexOf(extensionTypes[extension]) !== -1;
  }

  function cleanHtmlText(value) {
    var documentFragment = new DOMParser().parseFromString(value, "text/html");
    return (documentFragment.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function parseJsonResponse(response) {
    return response.text().then(function (text) {
      var data;

      try {
        data = JSON.parse(text);
      } catch (error) {
        var cleaned = cleanHtmlText(text);
        throw new Error(
          cleaned || "The server returned an invalid response (HTTP " + response.status + ")."
        );
      }

      if (!response.ok || !data.ok) {
        throw new Error(data && data.error ? data.error : "The request failed.");
      }

      return data;
    });
  }

  function postForm(endpoint, data) {
    return fetch(endpoint, {
      method: "POST",
      body: data,
      credentials: "same-origin"
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function createController(panel) {
    var input = panel.querySelector(".dropzone__input");
    var list = panel.querySelector(".file-list");
    var clearButton = panel.querySelector("[data-clear]");
    var generateButton = panel.querySelector("[data-generate]");
    var counter = panel.querySelector(".counter__value");
    var status = panel.querySelector("[data-status]");
    var acceptedTypes = panel.dataset.acceptedTypes.split(",");
    var maxFiles = Number(panel.dataset.maxFiles);
    var files = [];
    var busy = false;

    function endpoint() {
      var url = new URL(panel.dataset.endpoint, window.location.href);
      var scaleInput = panel.querySelector('input[name="thumbnail-scale"]:checked');

      if (scaleInput) {
        url.searchParams.set("scale", scaleInput.value);
      }

      return url.href;
    }

    function setStatus(message) {
      status.textContent = message;
    }

    function setBusy(nextBusy) {
      busy = nextBusy;
      input.disabled = nextBusy;
      clearButton.disabled = nextBusy;
      generateButton.disabled = nextBusy || files.length === 0;

      Array.prototype.forEach.call(
        panel.querySelectorAll(".file__remove"),
        function (button) {
          button.disabled = nextBusy;
        }
      );

      Array.prototype.forEach.call(
        panel.querySelectorAll('input[name="thumbnail-scale"]'),
        function (radio) {
          radio.disabled = nextBusy;
        }
      );
    }

    function render() {
      files.sort(naturalSort);
      list.replaceChildren();

      files.forEach(function (file, index) {
        var item = document.createElement("li");
        var name = document.createElement("span");
        var control = document.createElement("span");
        var number = document.createElement("span");
        var removeButton = document.createElement("button");

        item.className = "file";
        name.className = "file__name";
        name.textContent = file.name;
        control.className = "file__control";
        number.className = "file__index";
        number.textContent = padNumber(index + 1);
        removeButton.className = "file__remove";
        removeButton.type = "button";
        removeButton.disabled = busy;
        removeButton.title = "Remove";
        removeButton.setAttribute("aria-label", "Remove " + file.name);
        removeButton.addEventListener("click", function () {
          if (busy) {
            return;
          }

          files.splice(index, 1);
          setStatus("");
          render();
        });

        control.appendChild(number);
        control.appendChild(removeButton);
        item.appendChild(name);
        item.appendChild(control);
        list.appendChild(item);
      });

      panel.classList.toggle("has-files", files.length > 0);
      counter.textContent = padNumber(files.length);
      generateButton.disabled = busy || files.length === 0;
    }

    function addFiles(fileList) {
      if (busy) {
        return;
      }

      var incoming = Array.prototype.slice.call(fileList);
      var accepted = incoming.filter(function (file) {
        return isAcceptedFile(file, acceptedTypes);
      });
      var rejectedCount = incoming.length - accepted.length;
      var available = Math.max(0, maxFiles - files.length);
      var added = accepted.slice(0, available);
      var overflowCount = accepted.length - added.length;
      var messages = [];

      files = files.concat(added);
      input.value = "";
      render();

      if (rejectedCount) {
        messages.push(
          rejectedCount === 1
            ? "One unsupported file was skipped."
            : rejectedCount + " unsupported files were skipped."
        );
      }

      if (overflowCount) {
        messages.push(
          overflowCount === 1
            ? "One image was skipped because the " + maxFiles + "-image limit was reached."
            : overflowCount + " images were skipped because the " + maxFiles + "-image limit was reached."
        );
      }

      if (messages.length) {
        window.alert(messages.join("\n"));
      }
    }

    function clearFiles() {
      if (busy) {
        return;
      }

      files = [];
      input.value = "";
      setStatus("");
      render();
    }

    async function startJob(sortedFiles, requestEndpoint) {
      var data = new FormData();
      var names = sortedFiles.map(function (file) { return file.name; });

      data.append("action", "start");
      data.append("count", String(sortedFiles.length));
      data.append("names", JSON.stringify(names));

      return parseJsonResponse(await postForm(requestEndpoint, data));
    }

    async function uploadFile(jobId, file, index, requestEndpoint) {
      var data = new FormData();

      data.append("action", "upload");
      data.append("job_id", jobId);
      data.append("index", String(index));
      data.append("name", file.name);
      data.append("image", file, file.name);

      return parseJsonResponse(await postForm(requestEndpoint, data));
    }

    async function finalizeJob(jobId, requestEndpoint) {
      var data = new FormData();
      data.append("action", "finalize");
      data.append("job_id", jobId);

      var response = await postForm(requestEndpoint, data);
      var contentType = response.headers.get("Content-Type") || "";

      if (response.ok && contentType.indexOf("application/zip") !== -1) {
        return response.blob();
      }

      var text = await response.text();
      var parsed;

      try {
        parsed = JSON.parse(text);
      } catch (error) {
        parsed = null;
      }

      throw new Error(
        parsed && parsed.error
          ? parsed.error
          : cleanHtmlText(text) || "The server could not generate the ZIP file."
      );
    }

    async function generateZip() {
      if (busy || files.length === 0) {
        return;
      }

      var sortedFiles = files.slice().sort(naturalSort);
      var isOptimiser = panel.dataset.tool === "optimiser";
      var requestEndpoint = isOptimiser ? null : endpoint();

      setBusy(true);

      try {
        if (isOptimiser) {
          if (!window.pngOptimizer) {
            throw new Error("The PNG compression engine could not be loaded.");
          }

          generateButton.textContent = "Loading…";
          setStatus("Loading compression engine.");

          var optimizedZip = await window.pngOptimizer.optimizeFiles(
            sortedFiles,
            function (progress) {
              if (progress.stage === "optimizing") {
                var count = padNumber(progress.index + 1) + " / " + padNumber(progress.total);
                generateButton.textContent = "Optimising " + count;
                setStatus("Optimising " + progress.fileName + ", " + count + ".");
              } else if (progress.stage === "zip") {
                generateButton.textContent = "Generating…";
                setStatus("Generating ZIP.");
              }
            }
          );

          downloadBlob(optimizedZip, "Output.zip");
          setStatus("ZIP downloaded.");
          return;
        }

        generateButton.textContent = "Starting…";
        setStatus("Starting upload.");

        var started = await startJob(sortedFiles, requestEndpoint);

        for (var index = 0; index < sortedFiles.length; index += 1) {
          var progress = padNumber(index + 1) + " / " + padNumber(sortedFiles.length);
          generateButton.textContent = "Uploading " + progress;
          setStatus("Uploading " + sortedFiles[index].name + ", " + progress + ".");
          await uploadFile(started.job_id, sortedFiles[index], index, requestEndpoint);
        }

        generateButton.textContent = "Generating…";
        setStatus("Generating ZIP.");

        var blob = await finalizeJob(started.job_id, requestEndpoint);
        downloadBlob(blob, "Output.zip");
        setStatus("ZIP downloaded.");
      } catch (error) {
        console.error(error);
        setStatus("Processing failed.");
        window.alert(error.message || "Processing failed.");
      } finally {
        generateButton.textContent = DEFAULT_BUTTON_LABEL;
        setBusy(false);
      }
    }

    input.addEventListener("change", function () {
      addFiles(input.files);
    });
    clearButton.addEventListener("click", clearFiles);
    generateButton.addEventListener("click", generateZip);

    render();

    return {
      panel: panel,
      addFiles: addFiles,
      isBusy: function () { return busy; }
    };
  }

  function activeController() {
    var activeTool = document.querySelector('.tab-input[name="tool"]:checked');
    var toolName = activeTool ? activeTool.id.replace("tab-", "") : "trimmer";

    return controllers.find(function (controller) {
      return controller.panel.dataset.tool === toolName;
    });
  }

  function isFileDrag(event) {
    return event.dataTransfer &&
      Array.prototype.indexOf.call(event.dataTransfer.types || [], "Files") !== -1;
  }

  function clearDragState() {
    controllers.forEach(function (controller) {
      controller.panel.classList.remove("is-dragging");
    });
  }

  document.addEventListener("dragover", function (event) {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    clearDragState();

    var controller = activeController();
    if (controller && !controller.isBusy()) {
      controller.panel.classList.add("is-dragging");
    }
  });

  document.addEventListener("dragleave", function (event) {
    if (!event.relatedTarget) {
      clearDragState();
    }
  });

  document.addEventListener("drop", function (event) {
    if (!isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    clearDragState();

    var controller = activeController();
    if (controller) {
      controller.addFiles(event.dataTransfer.files);
    }
  });

  window.addEventListener("blur", clearDragState);
})();
