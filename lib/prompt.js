var async = require('async');
var fs = require('fs');
var readline = require('readline');
var validator = require('validator');

function prompt() {
}

var nullFormatter = function(txt) { return txt; };

prompt.prototype.descriptionFormatter = nullFormatter;
prompt.prototype.promptFormatter = nullFormatter;
prompt.prototype.errorFormatter = nullFormatter;

prompt.prototype.run = function(questions, callback) {
    var obj = {};
    this.updateObject(obj, questions, function(err) {
        return callback(err, obj);
    }.bind(this));
};

prompt.prototype.updateObject = function(obj, questions, callback) {
    var self = this;
    var tasks = [];

    questions.forEach(function(question) {
        if(typeof obj[question.name] !== "undefined") {
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

prompt.prototype.question = function(question, callback) {
    var self = this;

    question.prompttext = question.prompttext || " > ";
    question.error = question.error || "A response is required.";

    if(question.description) {
        process.stdout.write(self.descriptionFormatter(question.description) + "\n");
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

        process.stdout.write("\n");
        return callback(null, answer);
    });
};

prompt.prototype.integer = function(input) {
    if(validator.isInt(input)) {
        return validator.toInt(input);
    }

    return null;
}

prompt.prototype.boolean = function(input) {
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

prompt.prototype.filepath = function(input) {
    if(fs.existsSync(input)) {
        return input;
    }

    return null;
}

module.exports = new prompt();
