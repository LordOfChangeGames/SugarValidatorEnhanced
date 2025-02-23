# SugarValidator Enhanced
Based on Goctionni's [SugarValidator](https://goctionni.github.io/SugarValidator/index.html). Validates SugarCube games, find bugs quickly and easily, with various improvements over the original

## Description
This is a validator made for SugarCube games. It takes your game's HTML file as input, collects all passages from the game and does some basic validation checks to check that `<<` and `>>` are matched correctly, and that the `<<if>>` `<<elseif>>` `<<else>>` `<</if>>` are structured correctly, among other things.

Most SugarCube games will ship with a few of these types of errors. Now you can easily check for them and fix them before your users do.

## Changes from the main branch
* Improved macro validation to prevent various false positives
* Warnings for uneven number of parentheses, curly braces and brackets in a passage
* Support for `no-warnings` passage tag to ignore warnings linked to unven numbers of parentheses, curly braces, brackets and double quotation marks
* Support for `no-scan` passage tag to ignore scanning a passage altogether for unused, WIP passages (This is not a recommended practice, but the option exists)

## Planned features
* Improved `<<if>>` `<<elseif>>` condition checks
* Usage of commas between arguments in a `case`
* Unmatched HTML tags
* Sorting warnings/errors by type
* Possibility to hide errors (to use as a fix checklist)

## How to use
* You can run this in your browser
* You can install this as an npm-package
  * Run it in cli
  * As a module in your script
* You can run this tool as a node-script

### Running in your browser

You will be able to run this tool in the [browser](https://lordofchangegames.github.io/SugarValidatorEnhanced/), by simply drag-and-dropping your game's html file to see any issues. Depending on the filesize, the results can be near instant or take a while.

### Install as an NPM package

Once installed as an NPM package, you can use `sugarvalidator` as a cli command (with path to the file to parse), or as a module in your script.

To install NPM Package, run

```sh
# global
npm i sugarvalidator -g
# local
npm i sugarvalidator
```

**Use via CLI**
```sh
# If installed globally, or running as npm-script
sugarvalidator ./MyGame.html
# If installed locally
./node_modules/.bin/sugarvalidator ./MyGame.html
```

**Use as Module**
```javascript
const html = '' // your game's HTML-file-content
const validate = require('sugarvalidator');
console.log(validate(html));
```

### Running this tool as a node-script

* Create a new folder within your project (ie: validator)
* Download the files as a zip
* Extract the files into the newly created folder
* Run the following command:

```sh
$ node ./validator/cli ./YourGame.html
```

### Credits

A huge thank you to Goctionni for the original project. It has been a huge help for me and many other developers. I am returning the favor by updating your wonderful work. 

Special thanks to the developers that are providing feedback for the SugarValidatorEnhanced project (Pyo, Regina Sedinae), your comments are greatly helping me to make this project even more useful to developers.
