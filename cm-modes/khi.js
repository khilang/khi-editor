(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  CodeMirror.defineMode("khi", function () {

    function getStack(state) {
      if (state.stack.length !== 0) {
        return state.stack[state.stack.length - 1];
      } else {
        return null;
      }
    }

    function popStack(state) {
      return state.stack.pop();
    }

    function pushStack(state, mode) {
      state.stack.push(mode);
    }

    function replaceStack(state, mode) {
      let s = state.stack.pop();
      state.stack.push(mode);
      return s;
    }

    /**
     * Check that the number of columns in the last row and this row is equal.
     *
     * @param lastN Columns in last row (or null if this is the first row).
     * @param thisN Columns in this row.
     * @returns {boolean}
     */
    function check_columns(lastN, thisN) {
      if (thisN === 0) {
        return false;
      } else if (lastN === null) {
        return true;
      } else {
        return lastN === thisN;
      }
    }

    function isValidEscape(c) {
      return (
          c === '{' || c === '}' || c === '[' || c === ']' || c === '<' || c === '>' || c === '"' ||
          c === ':' || c === ';' || c === '|' || c === '~' || c === '`' || c === '#' || c === 'n'
      );
    }

    function classifyCharacter(stream) {
      let c = stream.next();
      let d;
      if (c === undefined) {
        c = null;
        d = null;
      } else {
        d = stream.next();
        if (d === undefined) {
          d = null;
          stream.backUp(1);
        } else {
          stream.backUp(2);
        }
      }
      if (c === '{') {
        return CLASS_LEFT_BRACKET;
      } else if (c === '}') {
        return CLASS_RIGHT_BRACKET;
      } else if (c === '[') {
        return CLASS_LEFT_SQUARE;
      } else if (c === ']') {
        return CLASS_RIGHT_SQUARE;
      } else if (c === '<') {
        if (d === '<') {
          return CLASS_REPEATED_ESCAPE_SEQUENCE;
        } else if (d === '>') {
          return CLASS_DIAMOND;
        } else if (d === '#') {
          return CLASS_LEFT_ANGLE_HASH;
        } else {
          return CLASS_LEFT_ANGLE;
        }
      } else if (c === '>') {
        return d === '>' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_RIGHT_ANGLE;
      } else if (c === '"') {
        return CLASS_QUOTE;
      } else if (c === ':') {
        return d === ':' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_COLON;
      } else if (c === ';') {
        return d === ';' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_SEMICOLON;
      } else if (c === '|') {
        return d === '|' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_BAR;
      } else if (c === '~') {
        return d === '~' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_TILDE;
      } else if (c === '`') {
        return isValidEscape(d) ? CLASS_CHARACTER_ESCAPE_SEQUENCE : CLASS_ERROR;
      } else if (c === '#') {
        if (d === '#' || /\s/.test(d) || d === null) {
          return CLASS_COMMENT;
        } else if (
            d === '{' || d === '}' || d === '[' || d === ']' || d === '<' || d === '>' || d === '"' ||
            d === ':' || d === ';' || d === '|' || d === '~'
        ) {
          return CLASS_ERROR;
        } else {
          return CLASS_GLYPH;
        }
      } else if (/\s/.test(c)) {
        return CLASS_WHITESPACE;
      } else if (c === null) {
        return CLASS_WHITESPACE;
      } else {
        return CLASS_GLYPH;
      }
    }

    const
        CLASS_WHITESPACE = "whitespace",
        CLASS_COMMENT = "comment",
        CLASS_GLYPH = "glyph",
        CLASS_CHARACTER_ESCAPE_SEQUENCE = "character-escape-sequence",
        CLASS_REPEATED_ESCAPE_SEQUENCE = "repeated-escape-sequence",
        CLASS_LEFT_BRACKET = "left-bracket",
        CLASS_RIGHT_BRACKET = "right-bracket",
        CLASS_LEFT_SQUARE = "left-square",
        CLASS_RIGHT_SQUARE = "right-square",
        CLASS_LEFT_ANGLE = "left-angle",
        CLASS_LEFT_ANGLE_HASH = "left-angle-hash",
        CLASS_DIAMOND = "diamond",
        CLASS_RIGHT_ANGLE = "right-angle",
        CLASS_QUOTE = "quote",
        CLASS_COLON = "colon",
        CLASS_SEMICOLON = "semicolon",
        CLASS_BAR = "bar",
        CLASS_TILDE = "tilde",
        CLASS_ERROR = "error";

    const
        STATE_WHITESPACE = "whitespace",
        STATE_COMMENT = "comment",
        STATE_WORD = "word",
        STATE_CHARACTER_ESCAPE_SEQUENCE = "character-escape-sequence",
        STATE_REPEATED_ESCAPE_SEQUENCE = "repeated-escape-sequence",
        STATE_QUOTE_OPEN = "quote::open",
        STATE_QUOTE_DETERMINE = "quote::determine",
        STATE_QUOTE_READ = "quote::read",
        STATE_MULTILINE_QUOTE_OPEN = "multiline-quote::open",
        STATE_MULTILINE_QUOTE_READ = "multiline-quote::read",
        STATE_BRACKET_OPEN = "bracket::open",
        STATE_BRACKET_FIRST = "bracket::first",
        STATE_BRACKET_SECOND = "bracket::second",
        STATE_BRACKET_CLOSE = "bracket::close",
        STATE_EXPRESSION = "expression",
        STATE_DICTIONARY_KEY = "dictionary::key",
        STATE_DICTIONARY_COLON = "dictionary::colon",
        STATE_DICTIONARY_VALUE = "dictionary::value",
        STATE_DICTIONARY_SEMICOLON = "dictionary::semicolon",
        STATE_SQUARE_OPEN = "square::open",
        STATE_SQUARE_CONTENT = "square::content",
        STATE_SQUARE_CLOSE = "square::close",
        STATE_SEQUENTIAL_VALUE = "sequential::value",
        STATE_SEQUENTIAL_SEPARATOR = "sequential::separator",
        STATE_SEQUENTIAL_ROW = "sequential::row",
        STATE_TABULAR_SEPARATOR = "tabular::separator",
        STATE_TABULAR_VALUE = "tabular::value",
        STATE_DIRECTIVE_OPEN = "directive::open",
        STATE_DIRECTIVE_COMMAND = "directive::command",
        STATE_DIRECTIVE_ATTRIBUTE = "directive::attribute",
        STATE_DIRECTIVE_COLON = "directive::colon",
        STATE_DIRECTIVE_VALUE = "directive::value",
        STATE_DIRECTIVE_CLOSE = "directive::close",
        STATE_ARGUMENT_COLON = "argument::colon",
        STATE_ARGUMENT_VALUE = "argument::value",
        STATE_ARGUMENT_COMPOSE = "argument::compose",
        STATE_ERROR = "error"
    ;

    const
        STYLE_NULL = "null",
        STYLE_COMMENT = "comment",
        STYLE_QUOTE = "string",
        STYLE_WORD = "null",
        STYLE_WORD_ARGUMENT = "number",
        STYLE_ATTRIBUTE_VALUE = "property",
        STYLE_ESCAPED = "string",
        STYLE_BRACKET = "bracket",
        STYLE_PUNCTUATION = "punctuation",
        STYLE_OPERATOR = "builtin",
        STYLE_KEY = "keyword",
        STYLE_ATTRIBUTE = "attribute",
        STYLE_TAG = "tag",
        STYLE_ERROR = "error";

    return {
      startState: function () {
        return {
          stack: [{mode: STATE_EXPRESSION}],
        };
      },
      token: function (stream, state) {

        while (true) {
          let head = getStack(state);
          if (head === null) {
            pushStack(state, {mode: STATE_ERROR});
            continue;
          }
          console.log(head.mode); //////////////
          let mode = head.mode;
          if (mode === STATE_WHITESPACE) { // ++
            popStack(state);
            stream.eatSpace();
            return STYLE_NULL;
          } else if (mode === STATE_COMMENT) { // ++
            popStack(state);
            stream.skipToEnd();
            return STYLE_COMMENT;
          } else if (mode === STATE_WORD) { // ++
            // Expect glyph or escape, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH) {
              let style = head.style;
              stream.next();
              while (classifyCharacter(stream) === CLASS_GLYPH) {
                stream.next();
              }
              return style;
            } else if (t === CLASS_CHARACTER_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_CHARACTER_ESCAPE_SEQUENCE});
            } else if (t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_REPEATED_ESCAPE_SEQUENCE});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_CHARACTER_ESCAPE_SEQUENCE) { // ++
            popStack(state);
            stream.next();
            stream.next();
            return STYLE_ESCAPED;
          } else if (mode === STATE_REPEATED_ESCAPE_SEQUENCE) { // ++
            popStack(state);
            let c = stream.next();
            while (stream.peek() === c) {
              stream.next();
            }
            return STYLE_ESCAPED;
          } else if (mode === STATE_QUOTE_OPEN) { // ++
            // Assume quote.
            replaceStack(state, {mode: STATE_QUOTE_READ});
            stream.next();
          } else if (mode === STATE_QUOTE_DETERMINE) { //++
            // Expect quote, escape character or regular character.
            let c = stream.peek();
            if (c === '"') {
              replaceStack(state, {mode: STATE_QUOTE_READ});
            } else if (c === '`') {
              if (classifyCharacter(stream) === CLASS_CHARACTER_ESCAPE_SEQUENCE) {
                pushStack(state, {mode: STATE_CHARACTER_ESCAPE_SEQUENCE});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (c === undefined) {
              return STYLE_QUOTE;
            } else {
              replaceStack(state, {mode: STATE_QUOTE_READ});
            }
          } else if (mode === STATE_QUOTE_READ) { // ++
            let c = stream.peek();
            if (c === '"') {
              popStack(state);
              c = stream.next();
              return STYLE_QUOTE;
            } else if (c === '`' || c === undefined) {
              replaceStack(state, {mode: STATE_QUOTE_DETERMINE});
              return STYLE_QUOTE;
            } else {
              c = stream.next();
            }
          } else if (mode === STATE_MULTILINE_QUOTE_OPEN) { // ++
            // Consume left angle hash.
            stream.next();
            stream.next();
            let label = "";
            while (true) {
              let c = stream.next();
              if (c === '>') {
                replaceStack(state, {mode: STATE_MULTILINE_QUOTE_READ, label: label});
                break;
              } else if (/\s/.test(c) || c === undefined) {
                pushStack(state, {mode: STATE_ERROR});
                break;
              } else {
                label += c;
              }
            }
          } else if (mode === STATE_MULTILINE_QUOTE_READ) { // ++
            let m = '<' + '#' + head.label + '>';
            while (true) {
              if (stream.match(m)) {
                popStack(state);
                return STYLE_QUOTE;
              } else {
                if (stream.next() === undefined) {
                  return STYLE_QUOTE;
                }
              }
            }
          } else if (mode === STATE_BRACKET_OPEN) { // ++
            // Assume left bracket.
            replaceStack(state, {mode: STATE_BRACKET_FIRST});
            stream.next();
            return STYLE_BRACKET;
          } else if (mode === STATE_BRACKET_FIRST) { // ++
            // Skip whitespace. Expect word, quote or other component, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_BRACKET_SECOND});
              pushStack(state, {mode: STATE_WORD, style: STYLE_NULL}); // TODO: Determine by lookahead?
            } else if (t === CLASS_QUOTE) {
              replaceStack(state, {mode: STATE_BRACKET_SECOND});
              pushStack(state, {mode: STATE_QUOTE_OPEN}); // TODO: Determine by lookahead?
            } else if (t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
            }
          } else if (mode === STATE_BRACKET_SECOND) { // ++
            // Skip whitespace. Expect component, colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_DICTIONARY_COLON});
            } else {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
            }
          } else if (mode === STATE_BRACKET_CLOSE) { // ++
            // Expect right bracket.
            let t = classifyCharacter(stream);
            if (t === CLASS_RIGHT_BRACKET) {
              popStack(state);
              stream.next();
              return STYLE_BRACKET;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_EXPRESSION) { // ++
            // Skip whitespace. Expect component, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_WORD, style: STYLE_WORD});
            } else if (t === CLASS_QUOTE) {
              pushStack(state, {mode: STATE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              pushStack(state, {mode: STATE_MULTILINE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE) {
              pushStack(state, {mode: STATE_DIRECTIVE_OPEN});
            } else if (t === CLASS_TILDE) {
              stream.next();
              return STYLE_OPERATOR;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_DICTIONARY_KEY) { // ++
            // Skip whitespace. Expect key or end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_KEY});
            } else if (t === CLASS_QUOTE) {
              replaceStack(state, {mode: STATE_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_QUOTE_OPEN, style: STYLE_KEY});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_DICTIONARY_COLON) { // ++
            // Skip whitespace. Expect colon.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_DICTIONARY_VALUE});
              stream.next();
              return STYLE_PUNCTUATION;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_DICTIONARY_VALUE) { // ++
            // Skip whitespace. Expect value.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_DICTIONARY_SEMICOLON});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_DICTIONARY_SEMICOLON) { // ++
            // Skip whitespace. Expect semicolon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_SEMICOLON) {
              replaceStack(state, {mode: STATE_DICTIONARY_KEY});
              stream.next();
              return STYLE_PUNCTUATION;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_SQUARE_OPEN) { // ++
            // Expect left square.
            replaceStack(state, {mode: STATE_SQUARE_CONTENT});
            stream.next();
            return STYLE_BRACKET;
          } else if (mode === STATE_SQUARE_CONTENT) { // ++
            // Skip whitespace. Expect value or bar, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
              pushStack(state, {mode: STATE_SEQUENTIAL_VALUE, lastN: null, thisN: 0});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
              pushStack(state, {mode: STATE_TABULAR_SEPARATOR, lastN: null, thisN: 0});
            } else {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
            }
          } else if (mode === STATE_SQUARE_CLOSE) { // ++
            // Skip whitespace. Expect right square.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_SQUARE) {
              popStack(state);
              stream.next();
              return STYLE_BRACKET;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_SEQUENTIAL_VALUE) { // ++
            // Skip whitespace. Expect value.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_SEQUENTIAL_SEPARATOR, lastN: head.lastN, thisN: head.thisN + 1});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_SEQUENTIAL_SEPARATOR) { // ++
            // Skip whitespace. Expect bar or semicolon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_SEQUENTIAL_VALUE, lastN: head.lastN, thisN: head.thisN});
              stream.next();
              return STYLE_PUNCTUATION;
            } else if (t === CLASS_SEMICOLON) {
              if (check_columns(head.lastN, head.thisN)) {
                replaceStack(state, {mode: STATE_SEQUENTIAL_ROW, lastN: head.thisN});
                stream.next();
                return STYLE_PUNCTUATION;
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else {
              if (check_columns(head.lastN, head.thisN)) {
                popStack(state);
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            }
          } else if (mode === STATE_SEQUENTIAL_ROW) { // ++
            // Skip whitespace. Expect value, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_SEQUENTIAL_VALUE, lastN: head.lastN, thisN: 0});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_TABULAR_SEPARATOR) { // ++
            // Skip whitespace. Expect bar.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_TABULAR_VALUE, lastN: head.lastN, thisN: head.thisN});
              stream.next();
              return STYLE_PUNCTUATION;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_TABULAR_VALUE) { // ++
            // Skip whitespace. Expect value or bar, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTE ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_TABULAR_SEPARATOR, lastN: head.lastN, thisN: head.thisN + 1});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else if (t === CLASS_BAR) {
              if (check_columns(head.lastN, head.thisN)) {
                replaceStack(state, {mode: STATE_TABULAR_SEPARATOR, lastN: head.thisN, thisN: 0});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else {
              if (check_columns(head.lastN, head.thisN)) {
                popStack(state);
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            }
          } else if (mode === STATE_DIRECTIVE_OPEN) { // ++
            // Expect left angle.
            let t = classifyCharacter(stream);
            if (t === CLASS_LEFT_ANGLE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_COMMAND});
              stream.next();
              return STYLE_TAG;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_DIRECTIVE_COMMAND) { // ++
            // Skip whitespace. Expect command.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_WORD, style: STYLE_TAG});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_DIRECTIVE_ATTRIBUTE) { // ++
            // Skip whitespace. Expect attribute, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE});
            } else {
              replaceStack(state, {mode: STATE_DIRECTIVE_CLOSE});
            }
          } else if (mode === STATE_DIRECTIVE_COLON) { // ++
            // Expect whitespace or colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_DIRECTIVE_VALUE});
              stream.next();
              return STYLE_TAG;
            } else {
              replaceStack(state, {mode: STATE_DIRECTIVE_CLOSE});
            }
          } else if (mode === STATE_DIRECTIVE_VALUE) { // ++
            // Expect attribute value.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE_VALUE});
            } else if (t === CLASS_QUOTE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_MULTILINE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_ATTRIBUTE});
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_DIRECTIVE_CLOSE) { // ++
            // Skip whitespace. Expect right angle.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_ANGLE) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              stream.next();
              return STYLE_TAG;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_ARGUMENT_COLON) { // ++
            // Expect colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_ARGUMENT_VALUE});
              stream.next();
              return STYLE_OPERATOR;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_ARGUMENT_VALUE) { // ++
            // Expect argument.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_WORD_ARGUMENT});
            } else if (t === CLASS_QUOTE) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              pushStack(state, {mode: STATE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              pushStack(state, {mode: STATE_MULTILINE_QUOTE_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              replaceStack(state, {mode: STATE_ARGUMENT_COLON});
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE) {
              replaceStack(state, {mode: STATE_DIRECTIVE_OPEN}); // TODO Maybe?
            } else if (t === CLASS_DIAMOND) {
              replaceStack(state, {mode: STATE_ARGUMENT_COMPOSE});
              stream.next();
              stream.next();
              return STYLE_OPERATOR;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_ARGUMENT_COMPOSE) { // ++
            // Expect colon.
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_DIRECTIVE_OPEN}); // TODO Maybe?
              stream.next();
              return STYLE_OPERATOR;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_ERROR) { // ++
            stream.skipToEnd();
            return STYLE_ERROR;
          }
        }
      }
    };
  });

  CodeMirror.defineMIME('application/khi', 'khi');

});
