// Needed this comment to redo the deployment
function validate(fileData, localStorage = {}) {
    const validationErrors = {};
    const validationWarnings = {}

    const entityMap = {
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': `'`,
        '&amp;': '&',
        '\t': '  ',
    };
    function decodeHTML(encodedStr) {
        const input = Object.keys(entityMap);
        for(const k of input) {
            const v = entityMap[k];
            while(encodedStr.indexOf(k) !== -1) {
                encodedStr = encodedStr.replace(k, v);
            }
        }
        return encodedStr;
    }

    function recodeHTML(str) {
        const recodeMap = Object.keys(entityMap).reduce((map, key) => {
            const intermediate = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36) + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
            return [
                ...map,
                { replace: key, intermediate, find: entityMap[key] },
            ];
        }, []);
        // Find replace find's with intermediate's
        for (const { replace, intermediate, find } of recodeMap) {
            while(str.indexOf(find) !== -1) {
                str = str.replace(find, intermediate);
            }
        }
        // Then replace intermediate's with replace's
        for (const { replace, intermediate, find } of recodeMap) {
            while(str.indexOf(intermediate) !== -1) {
                str = str.replace(intermediate, replace);
            }
        }
        return str;
    }

    const exclusionMarkup = [
        ['"""', '"""', 'Markup escape'],
        ['<nowiki>', '</nowiki>', 'Markup escape'],
        ['{{{', '}}}', 'Markup escape'],
        ['/*', '*/', 'Markup escape'],
        ['/%', '%/', 'Markup escape'],
        ['<!--', '-->', 'Markup escape'],
        ['<<script>>', '<</script>>', 'Script']
    ];
    function recodeExcludedHTML(html, header) {
        let startIndex = 0;
        while(true) {
            let firstIndex = html.length;
            let firstMarkup = null;
            for(const markup of exclusionMarkup) {
                const index = html.indexOf(markup[0], startIndex);
                if (index !== -1 && index < firstIndex) {
                    firstIndex = index;
                    firstMarkup = markup;
                }
            }
            // If none of the opening markup can be found, we're done
            if (!firstMarkup) {
                return html;
            }
            // If something is found, find the matching closing markup
            const closingIndex = html.indexOf(firstMarkup[1], firstIndex + firstMarkup[0].length);
            // If no closing markup is found, add a warning and stop trying to exclude further markup
            if (closingIndex === -1) {
                addWarning([
                    [`Found $$1 opening '$$2', but no subsequent closing '$$3'`, firstMarkup[2], firstMarkup[0], firstMarkup[1]],
                ], header);
                return html;
            }
            // modify html to re-encode the excluded markup
            html = html.substr(0, firstIndex + firstMarkup[0].length) + recodeHTML(html.substring(firstIndex + firstMarkup[0].length, closingIndex)) + html.substr(closingIndex);
            startIndex = closingIndex + firstMarkup[1].length;
        }
    }
    
    function getHTMLAttr(html, attr) {
        const startStr = `${attr}="`;
        const start = html.indexOf(startStr);
        if (start === -1) return null;
        const end = html.indexOf('"', start + startStr.length);
        if (end === -1) return null;
        return html.substring(start + startStr.length, end);
    }
    
    const passageStartTag = '<tw-passagedata';
    const passageCloseTag = '</tw-passagedata>';
    const passages = [];
    const passageNameIndex = {};
    const passageIdIndex = {};
    let lastIndex = 0;
    while(true) {
        const startIndex = fileData.indexOf(passageStartTag, lastIndex);
        if (startIndex === -1) break;
        const endIndex = fileData.indexOf(passageCloseTag, startIndex);
        if (endIndex === -1) throw 'Unclosed passage found: ' + fileData.substr(startIndex, 200);
        const contentIndex = fileData.indexOf('>', startIndex) + 1;
        const header = fileData.substring(startIndex, contentIndex);
        const content = recodeExcludedHTML(decodeHTML(fileData.substring(contentIndex, endIndex)), header);
        const id = getHTMLAttr(header, 'pid');
        const name = getHTMLAttr(header, 'name');
        const passage = { header, content, id, name };
    
        // Add stuff
        passages.push(passage);
        if (name) passageNameIndex[name] = passage;
        if (id) passageIdIndex[id] = passage;
        lastIndex = endIndex + passageCloseTag.length;
    }
    
    function throwError(msg, passage) {
        validationErrors[passage.header] = msg.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        throw 'Error';
    }

    function addError(msg, header) {
        if (!validationErrors[header]) validationErrors[header] = [];
        validationErrors[header].push(msg);
    }

    function addWarning(msg, header) {
        if (!validationWarnings[header]) validationWarnings[header] = [];
        validationWarnings[header].push(msg);
    }

    function matchQuotes(html, passage) {
        const numDoubleQuotes = html.split('"').length - 1;
        const numSingleQuotes = html.split("'").length - 1;
        const unevenDoubleQuotes = (numDoubleQuotes % 2) === 1;
        const unevenSingleQuotes = (numSingleQuotes % 2) === 1; // single quotes can reasonably be used in plain english
        if (unevenDoubleQuotes) addWarning([['Uneven number of double-quotes in passage']], passage.header);
        // if (unevenSingleQuotes) addWarning([['Uneven number of single-quotes in']], passage.header);
    }

    function matchPairs(html, passage) {   // using warnings in case someone uses old school smileys in their code :)
        const numParenthesis = [html.split("(").length - 1, html.split(")").length - 1];
        if (numParenthesis[0] > numParenthesis[1]) addWarning([['More opening than closing parenthesis in passage']], passage.header)
        else if (numParenthesis[0] < numParenthesis[1]) addWarning([['More closing than opening parenthesis in passage']], passage.header);
        const numBrackets = [html.split("[").length - 1, html.split("]").length - 1];
        if (numBrackets[0] > numBrackets[1]) addWarning([['More opening than closing brackets in passage']], passage.header)
        else if (numBrackets[0] < numBrackets[1]) addWarning([['More closing than opening brackets in passage']], passage.header);
        const numCurlyBraces = [html.split("{").length - 1, html.split("}").length - 1];
        if (numCurlyBraces[0] > numCurlyBraces[1]) addWarning([['More opening than closing curly braces']], passage.header)
        else if (numCurlyBraces[0] < numCurlyBraces[1]) addWarning([['More closing than opening curly braces']], passage.header);
    }
    
    function matchGTLT(html, passage) {
        let htmlClone = html;
        while(true) {
            const start = htmlClone.lastIndexOf('<<');
            const end = htmlClone.indexOf('>>', start);
            if (start === -1 && end === -1) return;
            if (start === -1 || end === -1) {
                if (start !== -1) {
                    const lineend = html.indexOf('\n', start);
                    const linestart = html.substr(0, lineend).lastIndexOf('\n');
                    const line = html.substring(linestart, lineend).trim().substr(0, 160);
                    return throwError(`Found an opening '<<' without matching '>>' Line: ${line}`, passage);
                } else {
                    const lineend = html.indexOf('\n', end);
                    const linestart = html.substr(0, lineend).lastIndexOf('\n');
                    const line = html.substring(linestart, lineend).trim().substr(0, 160);
                    return throwError(`Found a closing '>>' without matching '<<' Line: ${line}`, passage);
                }
            }
            htmlClone = htmlClone.substr(0, start) + '{{' + htmlClone.substring(start + 2, end) + '}}' + htmlClone.substr(end + 2);
        }
    }

    function findLastIfOpeningIndex(html) {
        let maxIndex = html.length;
        while (true) {
            const index = html.substr(0, maxIndex).lastIndexOf('<<if');
            if (index === -1) {
                return -1;
            }
            const nextChar = html[index + 4];
            if (nextChar.match(/[^\w-]/)) {
                return index;
            } else {
                maxIndex  = index;
            }
        }
    }
    
    function matchIfs(html, passage) {
        while(true) {
            const start = findLastIfOpeningIndex(html);
            // If there is no <<if
            if (start === -1) {
                // But there's still an /if, elseif or else, something's fucked
                if (html.indexOf('<</if>>') !== -1) return throwError('Unmatched <</if>> found in passage', passage);
                if (html.indexOf('<<elseif') !== -1) return throwError('Unmatched <<elseif found in passage', passage);
                if (html.indexOf('<<else>>') !== -1) return throwError('Unmatched <<else>> found in passage', passage);
                // If none of those still exist, we're good
                return;
            }
            // If there still is an <<if
            // Make sure there is also an <</if>>
            const end1 = html.indexOf('<</if>>', start);
            const end2 = html.indexOf('<<endif>>', start);
            const end = (end2 === -1) ? end1 : (end1 === -1) ? end2 : Math.min(end1, end2);
            if (end === -1) return throwError('Unmatched <<if found in passage ' + html.substr(start, 40), passage);
            // Only look between the <<if and <</if>>
            const endOfIf = html.indexOf('>>', start);
            // But make sure our <<if isn't completely broken
            if (endOfIf > end) return throwError('Malformed <<if found in passage', passage);
            // Get content
            const content = html.substring(endOfIf + 2, end);
            // Check if there is an <<else>>
            const elseIndex = content.indexOf('<<else>>', start);
            // If so, make sure there isn't a another <<else>> or an <<elseif after the <<else>>
            if (elseIndex !== -1) {
                if (content.indexOf('<<else>>', elseIndex + 1) !== -1) return throwError('Double <<else>> found inside if block in passage', passage);
                if (content.indexOf('<<elseif', elseIndex + 1) !== -1) return throwError('<<elseif found after <<else>> found inside if block in passage', passage);
            }
            // Remove this if block from the HTML
            html = html.substr(0, start) + html.substr(end + 7);
        }
    }

    function findInvalidConditions(html, passage) {
        const matches = html.match(/<<(else)?if [^>]* is(not)? (gt|gte|lt|lte) [^>]*>>/g);
        if (matches) addError([[`Invalid condition found: '${matches[0]}', is/isnot should not be used in combination with lt/lte/gt/gte`]], passage.header);
    }

    function findInvalidSetters(html, passage) {
        const matching = html.match(/<<set [^>]* (==|===) [^>]*>>/g);
        if (matching) addError([[`Invalid setter found: '${matching[0]}', ==/=== should not be used in a <<set>>, use to or = instead`]], passage.header);
    }
    
    function checkInvalidWidgets(html, passage) {
        // Find our tags
        const tags = getHTMLAttr(passage.header, 'tags');
        // If one of this passage's tags is widget, we dont need to check if there are invalid widgets, cause they'd be valid in this passage
        if (tags.split(' ').indexOf('widget') !== -1) return;
        // Determine if there are any widget tags
        if (html.indexOf('<<widget ') !== -1) return throwError('<<widget found in passage without a widget tag', passage);
    }
    
    function findDeprecatedInPassage(html, passage) {
        const deprecationMap = {
            '<<click': '<<link',
            '<<endclick>>': '<</link>>',
            '<</click>>': '<</link>>',
            '<<endif>>': '<</if>>',
            '<<endnobr>>': '<</nobr>>',
            '<<endsilently>>': '<</silently>>',
            '<<endfor>>': '<</for>>',
            '<<endscript>>': '<</script>>',
            '<<endbutton>>': '<</button>>',
            '<<endappend>>': '<</append>>',
            '<<endprepend>>': '<</prepend>>',
            '<<endreplace>>': '<</replace>>',
            '<<endwidget>>': '<</widget>>',
            '<<setplaylist': '<<createplaylist',
            '<<stopallaudio>>': '<<audio ":all" stop>>',
            '<<display': '<<include',
            '<<forget': 'forget()',
            '<<remember': `memorize()' and 'recall()`,
            'state.active.variables': 'State.variables',
            'State.initPRNG(': 'State.prng.init(',
            '.containsAll(': '.includesAll(',
            '.containsAny(': '.includesAny(',
            '.flatten(': '.flat(',
        };
        const deprecationKeys = Object.keys(deprecationMap);
        for (const key of deprecationKeys) {
            if (html.indexOf(key) !== -1) {
                addWarning([[`Deprecated markup found in passage ('$$1' should be '$$2')`, key, deprecationMap[key]]], passage.header);
            }
        }
    }
    
    function findDeprecatedInScript() {
        const deprecationMap = {
            'state.active.variables': 'State.variables',
            'State.initPRNG(': 'State.prng.init(',
            '.containsAll(': '.includesAll(',
            '.containsAny(': '.includesAny(',
            '.flatten(': '.flat(',
            'macros.': 'Macro.add(',
        };
        const initialIndex = fileData.indexOf('id="twine-user-script"');
        const maxIndex = fileData.indexOf('</script>', initialIndex);
        const deprecationKeys = Object.keys(deprecationMap);
        for (const key of deprecationKeys) {
            let curIndex = initialIndex;
            while(true) {
                const startIndex = fileData.indexOf(key, curIndex);
                if (startIndex === -1) break;
                if (startIndex >= maxIndex) break;
                if (key === 'macros.') { // Special case, ignore if this is not stand-alone
                    const precedingChar = fileData.substr(startIndex - 1, 1);
                    if (precedingChar.match(/[\._a-z0-9]/i)) {
                        curIndex = startIndex + key.length;
                        continue;
                    }
                }
                const endOfLineIndex = fileData.indexOf('\n', startIndex);
                const lines = fileData.substring(0, endOfLineIndex).split('\n');
                const line = lines[lines.length - 1].trim();
                if (!line.startsWith('//') && !line.startsWith('/*')) {
                    addWarning([
                        ['Line $$1: $$2', lines.length, line],
                        ["'$$1' should be '$$2'", key, deprecationMap[key]],
                    ], 'Deprecated code found in Twine User-script');
                }
                curIndex = startIndex + key.length;
            }
        }
    }

    // ['script', 'widget', 'for', 'link', 'button']
    const allMacros = {
        // Native macros
        switch: { closed: true, sub: [ 'case', 'default'] },
        for: { closed: true, sub: [ 'break', 'continue'] },
        repeat: { closed: true, sub: [ 'stop' ] },
        cycle: { closed: true, sub: [ 'option', 'optionsfrom ']},
        listbox: { closed: true, sub: [ 'option', 'optionsfrom ']},
        timed: { closed: true, sub: [ 'next' ]},
        createaudiogroup: { closed: true, sub: [ 'track' ]},
        createplaylist: { closed: true, sub: [ 'track' ]},
    };
    function addSimpleMacro(name, closed) {
        allMacros[name] = { closed, sub: closed ? [] : undefined };
    }
    // Closed
    ['capture', 'script', 'nobr', 'silently', 'button', 'link', 'linkappend', 'linkprepend', 'linkreplace', 'append', 'prepend', 'replace', 'widget'].forEach((name) => addSimpleMacro(name, true));
    // Unclosed
    ['set', 'unset', 'run', '=', '-', 'include', 'print', 'checkbox', 'radiobutton', 'textarea', 'textbox', 'actions', 'back', 'choice', 'return', 'addclass'].forEach((name) => addSimpleMacro(name, false));
    ['copy', 'remove', 'removeclass', 'toggleclass', 'audio', 'cacheaudio', 'playlist', 'masteraudio', 'removeplaylist', 'waitforaudio', 'goto'].forEach((name) => addSimpleMacro(name, false));

    let failedToParseAllMacros = false;
    function tryEvalMacro(script) {
        const Macro = {
            add(name, { tags }) {
                if (name instanceof Array)
                    return name.map((n) => ({name: n, tags}));
                else
                    return [{ name , tags }];
            }
        }
        try {
            return eval(script);
        } catch (e) {
            return false;
        }
    }

    function loadIgnoredMacros() {
        if (localStorage) {
            const names = Object.keys(localStorage);
            for (const name of names) {
                if (!allMacros[name]) {
                    allMacros[name] = localStorage[name];
                }
            }
        }
    }
    function findAllCustomMacros() {
        const scriptStartIndex = fileData.indexOf('id="twine-user-script"');
        if (scriptStartIndex === -1) return;
        const scriptEndIndex = fileData.indexOf('</script>', scriptStartIndex);
        if (scriptEndIndex === -1) return;
        const userscript = fileData.substring(scriptStartIndex, scriptEndIndex);
        const macroStartSyntax = 'Macro.add(';
        let startIndex = 0;
        while(true) {
            const index = userscript.indexOf(macroStartSyntax, startIndex);
            if (index === -1) return;
            let innerStartIndex = startIndex = index + macroStartSyntax.length;
            let attempt = 0;
            while(true) {
                const possibleEndIndex = userscript.indexOf(')', innerStartIndex);
                const macroCode = userscript.substring(index, possibleEndIndex + 1);
                const results = tryEvalMacro(macroCode);
                if (results !== false) {
                    for (const result of  results) {
                        const { name , tags } = result;
                        allMacros[name] = { closed: (typeof tags !== 'undefined'), sub: tags };
                    }
                    startIndex = possibleEndIndex + 1;
                    break;
                } else {
                    innerStartIndex = possibleEndIndex + 1;
                    if (attempt++ > 100) {
                        failedToParseAllMacros = true;
                        break;
                    }
                }
            }
        }
    }

    function findAllCustomMacrosDeprecated() {
        const scriptStartIndex = fileData.indexOf('id="twine-user-script"');
        if (scriptStartIndex === -1) return;
        const scriptEndIndex = fileData.indexOf('</script>', scriptStartIndex);
        if (scriptEndIndex === -1) return;
        let userscript = fileData.substring(scriptStartIndex, scriptEndIndex);
        while(true) {
            const match = userscript.match(/macros\s*\.([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*{/);
            if (!match) break;
            
            const fullStr = match[0];
            const macroName = match[1];
            const innerStartIndex = match.index + fullStr.length - 1;
            let innerEndIndexMinBound = innerStartIndex;
            let attempt = 0;
            while(true) {
                const possibleEndIndex = userscript.indexOf('}', innerEndIndexMinBound);
                const macroCodeObj = userscript.substring(innerStartIndex, possibleEndIndex + 1);
                const macroCode = `Macro.add('${macroName}', ${macroCodeObj})`;
                const result = tryEvalMacro(macroCode);
                if (result !== false) {
                    const { name , tags } = result;
                    allMacros[name] = { closed: (typeof tags !== 'undefined'), sub: tags };
                    userscript = userscript.substr(innerStartIndex);
                    break;
                } else {
                    innerEndIndexMinBound = possibleEndIndex + 1;
                    if (attempt++ > 100) {
                        userscript = userscript.substr(innerStartIndex);
                        failedToParseAllMacros = true;
                        console.error('Could not find custom macro', macroName, macroCode);
                        break;
                    }
                }
            }
        }

        userscript = fileData.substring(scriptStartIndex, scriptEndIndex);
        while(true) {
            const match = userscript.match(/macros\s*\[['"]([a-zA-Z][a-zA-Z0-9_]*)["']\]\s*=\s*{/);
            if (!match) break;
            
            const fullStr = match[0];
            const macroName = match[1];
            const innerStartIndex = match.index + fullStr.length - 1;
            let innerEndIndexMinBound = innerStartIndex;
            let attempt = 0;
            while(true) {
                const possibleEndIndex = userscript.indexOf('}', innerEndIndexMinBound);
                const macroCodeObj = userscript.substring(innerStartIndex, possibleEndIndex + 1);
                const macroCode = `Macro.add('${macroName}', ${macroCodeObj})`;
                const result = tryEvalMacro(macroCode);
                if (result !== false) {
                    const { name , tags } = result;
                    allMacros[name] = { closed: (typeof tags !== 'undefined'), sub: tags };
                    userscript = userscript.substr(innerStartIndex);
                    break;
                } else {
                    innerEndIndexMinBound = possibleEndIndex + 1;
                    if (attempt++ > 100) {
                        userscript = userscript.substr(innerStartIndex);
                        failedToParseAllMacros = true;
                        console.error('Could not find custom macro', macroName, macroCode);
                        break;
                    }
                }
            }
        }
    }

    const allWidgets = [];
    let failedToParseAllWidgets = false;
    function findAllWidgets(html, passage) {
        // Find our tags
        const tags = getHTMLAttr(passage.header, 'tags');
        // If none of this passage's tags is widget, we dont need to check if there are any widgets
        if (tags.split(' ').indexOf('widget') === -1) return;
        // Find all widgets
        let startIndex = 0;
        while (true) {
            const find = '<<widget ';
            const index = html.indexOf(find, startIndex);
            if (index === -1) return;
            let widgetName = html.substr(index + find.length).trim().split(' ').shift().split('>').shift().split('\n').shift();
            if (widgetName[0] === '"' && widgetName[widgetName.length - 1] === '"') widgetName = widgetName.substring(1, widgetName.length - 1);
            else if (widgetName[0] === '$') failedToParseAllWidgets = true;
            if (allWidgets.indexOf(widgetName) === -1) allWidgets.push(widgetName);
            startIndex = index + find.length + widgetName.length;
        }
    }

    const excludeTags = ['if', 'else', 'elseif', 'endif', 'click', 'endclick', 'endnobr', 'endsilently', 'endfor', 'endscript', 'endbutton', 'endappend', 'endprepend', 'endreplace', 'endwidget', 'setplaylist', 'stopallaudio', 'display', 'remember', 'forget'];
    const excludePrefix = ['/', '-', '='];

    function isValidMacro(tagName) {
        return !excludeTags.includes(tagName) && !excludePrefix.includes(tagName[0]);
    }

    function findWidgetEquivalent(html, tagName) {
        const widgetPattern = new RegExp(`<<widget\\s+"${tagName}"\\s+container\\s*>>`);
        return html.match(widgetPattern);
    }

    function findAllTags(html, passage) {
        let ignoreTagInRange = [];
        let startIndex = 0;

        while (startIndex < html.length) {
            let index = html.indexOf('<<', startIndex);
            let macroType = 'widget';

            // Check for 'macro.add(' if '<<' is not found or if 'macro.add(' appears earlier in the HTML
            const macroAddIndex = html.indexOf('macro.add(', startIndex);
                if (macroAddIndex !== -1 && (index === -1 || macroAddIndex < index)) {
                index = macroAddIndex;
                macroType = 'add';
            }

            if (index === -1) break;

            let tagName;
            if (macroType === 'widget') {
                const endOfTag = html.indexOf('>>', index);
                tagName = html.substring(index + 2, endOfTag).split(/[\s\("'\[!]/).shift();
            } else {
                const tagNameStart = html.indexOf('\'', index) + 1;
                const tagNameEnd = html.indexOf('\'', tagNameStart);
                tagName = html.substring(tagNameStart, tagNameEnd);
            }

            if (excludePrefix.indexOf(tagName[0]) === -1 && excludeTags.indexOf(tagName) === -1) {
                if (tagName[0] === '$' || tagName[0] === '_') {
                    throwError(`Found '${macroType === 'widget' ? '<<' : 'macro.add('}${tagName}'. Though this doesn't cause errors directly in the game, something else was almost certainly intended (ie: '<<=${tagName}' or 'macro.add(${tagName})')`, passage);
                } else if (!ignoreTagInRange.some((item) => item.tag === tagName && index > item.range[0] && index < item.range[1])) {
                    const widgetEquivalent = findWidgetEquivalent(html, tagName);
                    if (widgetEquivalent) {
                        const widgetTag = widgetEquivalent[0];
                        const widgetStartIndex = html.indexOf(widgetTag, index);
                        const widgetCloseIndex = html.indexOf('<</widget>>', widgetStartIndex);

                        if (widgetCloseIndex === -1) {
                            throwError(`Widget '${tagName}' should be closed, but was not`, passage);
                        } else {
                            const hasContainer = widgetTag.includes('container');
                            if (hasContainer) {
                                const testCloseIndex = html.indexOf('<</' + tagName + '>>', index);
                                if (testCloseIndex === -1) {
                                    throwError(`Macro '${tagName}' should be closed, but was not`, passage);
                                } else {
                                    ignoreTagInRange.push({ tag: tagName, range: [index, testCloseIndex] });
                                }
                            }
                        }
                        startIndex = widgetCloseIndex + 9; // length of '<</widget>>'
                    } else {
                        startIndex = index + tagName.length + 2;
                    }
                } else {
                    startIndex = index + tagName.length + 2;
                }
            } else {
                startIndex = index + tagName.length + 2;
            }
        }
    }

    // First find all widgets and macros, so we can validate them later
    findAllCustomMacros();
    findAllCustomMacrosDeprecated();
    loadIgnoredMacros();
    for (const passage of passages) {
        findAllWidgets(passage.content, passage);
    }
    
    for (const passage of passages) {
        try {
            const tags = getHTMLAttr(passage.header, 'tags');
            if (!tags.includes('no-scan')) {
                if (!tags.includes('no-warnings')) {
                    matchQuotes(passage.content, passage);
                    matchPairs(passage.content, passage);
                }
                matchGTLT(passage.content, passage);
                matchIfs(passage.content, passage);
                findDeprecatedInPassage(passage.content, passage);
                findInvalidConditions(passage.content, passage);
                findInvalidSetters(passage.content, passage);
                checkInvalidWidgets(passage.content, passage);
                findAllTags(passage.content, passage);
            }
        } catch(e) {
            errorsFound = true;
        }
    }
    findDeprecatedInScript();

    return {
        failedToParseAllMacros,
        failedToParseAllWidgets,
        errors: validationErrors,
        warnings: validationWarnings,
    };
}

if (typeof module !== 'undefined') module.exports = validate;
