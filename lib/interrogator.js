var async = require('async');
var fs = require('fs');
var readline = require('readline');
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
        process.stdout.write(self.descriptionFormatter(question.description) + "\n");
    }

    if(question.options) {
        process.stdout.write(self.optionsFormatter(question.options) + "\n");
    }

    var rl = readline.createInterface({input: process.stdin, output: process.stdout});
    rl.question(self.promptFormatter(question.prompttext), function(answer) {
        rl.close();

        answer = validator.trim(answer);
        if(question.required && answer == "") {
            process.stdout.write(self.errorFormatter(question.error) + "\n");
            return self.question(question, callback);
        }

        answer = validator.trim(answer) || question.default;

        if(question.type) {
            answer = question.type(answer);
            if(answer === null) {
                process.stdout.write(self.errorFormatter(question.error) + "\n");
                return self.question(question, callback);
            }
        }

        if(question.options && typeof question.options[answer] === "undefined") {
            process.stdout.write(self.errorFormatter(question.error) + "\n");
            return self.question(question, callback);
        }

        process.stdout.write("\n");

        if(question.runAfter) {
            return question.runAfter(answer, callback);
        }

        return callback(null, answer);
    });
};

Interrogator.prototype.integer = function(input) {
    if(validator.isInt(input)) {
        return validator.toInt(input);
    }

    return null;
}

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
}

Interrogator.prototype.filepath = function(input) {
    if(fs.existsSync(input)) {
        return input;
    }

    return null;
}

module.exports = new Interrogator();
