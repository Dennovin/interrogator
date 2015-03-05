var async = require('async');
var fs = require('fs');
var read = require('read');
var validator = require('validator');
var sprintf = require('sprintf');
var Heap = require('heap');

function Interrogator() {
}

var nullFormatter = function(txt) { return txt; };

Interrogator.prototype.descriptionFormatter = nullFormatter;
Interrogator.prototype.promptFormatter = nullFormatter;
Interrogator.prototype.errorFormatter = nullFormatter;

Interrogator.prototype.optionLineFormatter = function(k, v) {
    return sprintf("%5s. %s", k, v);
};

Interrogator.prototype.optionsFormatter = function(options) {
    var optKeys = new Heap(function(a, b) { return a - b; });
    var optStrings = [];

    for(var i in options) {
        optKeys.push(i);
    }

    while(!optKeys.empty()) {
        var i = optKeys.pop();
        optStrings.push(this.optionLineFormatter(i, options[i]));
    }

    return optStrings.join("\n");
};

Interrogator.prototype.multiOptionLineFormatter = function(index, name, selected) {
    return sprintf(" [%s]  %3d. %s", (selected ? "*" : " "), index + 1, name);
};

Interrogator.prototype.multiOptionFormatter = function(options, optionsSelected) {
    var self = this;
    var optStrings = [];

    options.forEach(function(name, index) {
        optStrings.push(self.multiOptionLineFormatter(index, name, optionsSelected[index]));
    });

    return optStrings.join("\n");
};

Interrogator.prototype.run = function(questions, callback) {
    var obj = {};
    this.updateObject(obj, questions, function(err) {
        return callback(err, obj);
    }.bind(this));
};

Interrogator.prototype.updateObject = function(obj, questions, callback) {
    var self = this;
    var tasks = [];

    questions.forEach(function(question) {
        if(typeof obj[question.name] !== "undefined") {
            if(question.runAfter) {
                tasks.push(function(callback) {
                    question.runAfter(obj[question.name], callback);
                });
            }

            return;
        }

        tasks.push(function(callback) {
            self.question(question, function(err, result) {
                obj[question.name] = result;
                return callback(err);
            });
        });
    });

    async.series(tasks, function(err) {
        return callback(err);
    });
};

Interrogator.prototype.question = function(question, callback) {
    var self = this;

    question.prompttext = question.prompttext || " > ";
    question.error = question.error || "A response is required.";
    question.descriptionFormatter = question.descriptionFormatter || self.descriptionFormatter;
    question.optionsFormatter = question.optionsFormatter || self.optionsFormatter;
    question.errorFormatter = question.errorFormatter || self.errorFormatter;

    if(question.optionsFetcher) {
        return question.optionsFetcher(function(err, options) {
            if(err) {
                return callback(err);
            }

            question.options = options;
            delete question.optionsFetcher;
            return self.question(question, callback);
        });
    }

    if(question.description) {
        process.stdout.write(question.descriptionFormatter(question.description) + "\n");
    }

    if(question.options) {
        process.stdout.write(question.optionsFormatter(question.options) + "\n");
    }

    var readOptions = {
        "prompt": question.prompttext,
        "silent": question.silent
    };

    read(readOptions, function(err, answer, isDefault) {
        if(err) {
            return callback(err, null);
        }

        answer = validator.trim(answer);
        if(question.required && answer == "") {
            process.stdout.write(question.errorFormatter(question.error) + "\n");
            return self.question(question, callback);
        }

        answer = answer || question.default;

        if(question.type) {
            answer = question.type(answer);
            if(answer === null) {
                process.stdout.write(question.errorFormatter(question.error) + "\n");
                return self.question(question, callback);
            }
        }

        if(question.options && typeof question.options[answer] === "undefined") {
            process.stdout.write(question.errorFormatter(question.error) + "\n");
            return self.question(question, callback);
        }

        process.stdout.write("\n");

        if(question.runAfter) {
            return question.runAfter(answer, callback);
        }

        return callback(null, answer);
    });
};

Interrogator.prototype.multiSelect = function(question, callback) {
    var self = this;

    question.prompttext = question.prompttext || " > ";
    question.error = question.error || "Please enter a number to toggle that option, or press enter to accept the current selections.";
    if(!question.optionsSelected) {
        question.optionsSelected = {};

        if(question.defaults) {
            question.options.forEach(function(name, index) {
                if(question.defaults.indexOf(index) > -1 || question.defaults.indexOf(name) > -1) {
                    question.optionsSelected[index] = true;
                }
            });
        }
    }

    if(question.description) {
        process.stdout.write(self.descriptionFormatter(question.description) + "\n");
    }

    process.stdout.write(self.multiOptionFormatter(question.options, question.optionsSelected) + "\n");

    read({"prompt": question.prompttext}, function(err, answer, isDefault) {
        if(err) {
            return callback(err, null);
        }

        answer = validator.trim(answer);
        if(answer == "") {
            return callback(null, question.optionsSelected);
        }

        if(validator.isInt(answer)) {
            var i = validator.toInt(answer) - 1;
            question.optionsSelected[i] = !question.optionsSelected[i];
        }
        else {
            process.stdout.write(self.errorFormatter(question.error) + "\n");
        }

        return self.multiSelect(question, callback);
    });
};

Interrogator.prototype.integer = function(input) {
    if(validator.isInt(input)) {
        return validator.toInt(input);
    }

    return null;
};

Interrogator.prototype.boolean = function(input) {
    if(input === true || input === false) {
        return input;
    }

    if(!input) {
        return null;
    }

    var character = input.charAt(0).toLowerCase();
    if(["y", "t", "1"].indexOf(character) > -1) {
        return true;
    }
    if(["n", "f", "0"].indexOf(character) > -1) {
        return false;
    }

    return null;
};

Interrogator.prototype.filepath = function(input) {
    if(fs.existsSync(input)) {
        return input;
    }

    return null;
};

module.exports = new Interrogator();
