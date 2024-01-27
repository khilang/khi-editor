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
        return CLASS_QUOTATION_MARK;
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
          return CLASS_COMMENT_HASH;
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
        CLASS_COMMENT_HASH = "comment-hash",
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
        CLASS_QUOTATION_MARK = "quotation-mark",
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
        STATE_QUOTATION_OPEN = "quotation::open",
        STATE_QUOTATION_DETERMINE = "quotation::determine",
        STATE_QUOTATION_READ = "quotation::read",
        STATE_TEXT_BLOCK_OPEN = "text-block::open",
        STATE_TEXT_BLOCK_READ = "text-block::read",
        STATE_BRACKET_OPEN = "bracket::open",
        STATE_BRACKET_FIRST = "bracket::first",
        STATE_BRACKET_SECOND = "bracket::second",
        STATE_BRACKET_CLOSE = "bracket::close",
        STATE_EXPRESSION = "expression",
        STATE_EXPRESSION_SEPARABLE = "expression::separable",
        STATE_EXPRESSION_SEPARATOR = "expression::separator",
        STATE_EXPRESSION_WHITESPACE = "expression::whitespace",
        STATE_FLOW_DICTIONARY_KEY = "flow-dictionary::key",
        STATE_FLOW_DICTIONARY_COLON = "flow-dictionary::colon",
        STATE_FLOW_DICTIONARY_VALUE = "flow-dictionary::value",
        STATE_FLOW_DICTIONARY_SEMICOLON = "flow-dictionary::semicolon",
        STATE_BULLET_DICTIONARY_BULLET = "bullet-dictionary::bullet",
        STATE_BULLET_DICTIONARY_KEY = "bullet-dictionary::key",
        STATE_BULLET_DICTIONARY_COLON = "bullet-dictionary::colon",
        STATE_BULLET_DICTIONARY_VALUE = "bullet-dictionary::value",
        STATE_SQUARE_OPEN = "square::open",
        STATE_SQUARE_CONTENT = "square::content",
        STATE_SQUARE_CLOSE = "square::close",
        STATE_FLOW_TABLE_VALUE = "flow-table::value",
        STATE_FLOW_TABLE_SEPARATOR = "flow-table::separator",
        STATE_FLOW_TABLE_ROW = "flow-table::row",
        STATE_GRID_TABLE_SEPARATOR = "grid-table::separator",
        STATE_GRID_TABLE_VALUE = "grid-table::value",
        STATE_BULLET_TABLE_BULLET = "bullet-table::bullet",
        STATE_BULLET_TABLE_ENTRY = "bullet-table::entry",
        STATE_TAG_OPEN = "tag::open",
        STATE_TAG_NAME = "tag::name",
        STATE_TAG_ATTRIBUTE = "tag::attribute",
        STATE_TAG_COLON = "tag::colon",
        STATE_TAG_VALUE = "tag::value",
        STATE_TAG_CLOSE = "tag::close",
        STATE_PATTERN_COLON = "pattern::colon",
        STATE_PATTERN_ARGUMENT = "pattern::argument",
        STATE_PATTERN_COMPOSE = "pattern::compose",
        STATE_ERROR = "error";

    const
        STYLE_NULL = "null",
        STYLE_COMMENT = "comment",
        STYLE_QUOTE = "string",
        STYLE_WORD = "text",
        STYLE_WORD_ARGUMENT = "def",
        STYLE_ATTRIBUTE_VALUE = "attribute",
        STYLE_ESCAPED = "string",
        STYLE_BRACKET = "bracket",
        STYLE_PUNCTUATION = "bracket",
        STYLE_BULLET = "keyword",
        STYLE_OPERATOR = "builtin",
        STYLE_KEY = "keyword",
        STYLE_ATTRIBUTE = "attribute",
        STYLE_TAG = "tag",
        STYLE_ARGUMENT_COLON = "tag",
        STYLE_CONSTRUCTOR = "bracket",
        STYLE_MACRO = "type",
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
          let mode = head.mode;
          if (mode === STATE_WHITESPACE) {
            popStack(state);
            stream.eatSpace();
            return STYLE_NULL;
          } else if (mode === STATE_COMMENT) {
            popStack(state);
            stream.skipToEnd();
            return STYLE_COMMENT;
          } else if (mode === STATE_WORD) {
            // Expect glyph or escape, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH) {
              let style = head.style;
              stream.next();
              while (classifyCharacter(stream) === CLASS_GLYPH) {
                stream.next();
              }
              if (stream.eol()) popStack(state);
              return style;
            } else if (t === CLASS_CHARACTER_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_CHARACTER_ESCAPE_SEQUENCE});
            } else if (t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_REPEATED_ESCAPE_SEQUENCE});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_CHARACTER_ESCAPE_SEQUENCE) {
            popStack(state);
            stream.next();
            stream.next();
            return STYLE_ESCAPED;
          } else if (mode === STATE_REPEATED_ESCAPE_SEQUENCE) {
            popStack(state);
            let c = stream.next();
            while (stream.peek() === c) {
              stream.next();
            }
            return STYLE_ESCAPED;
          } else if (mode === STATE_QUOTATION_OPEN) {
            // Assume quote.
            replaceStack(state, {mode: STATE_QUOTATION_READ});
            stream.next();
          } else if (mode === STATE_QUOTATION_DETERMINE) {
            // Expect quote, escape character or regular character.
            if (stream.sol() || stream.eol()) {
              pushStack(state, {mode: STATE_ERROR});
              continue;
            }
            let c = stream.peek();
            if (c === '"') {
              replaceStack(state, {mode: STATE_QUOTATION_READ});
            } else if (c === '`') {
              if (classifyCharacter(stream) === CLASS_CHARACTER_ESCAPE_SEQUENCE) {
                pushStack(state, {mode: STATE_CHARACTER_ESCAPE_SEQUENCE});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else {
              replaceStack(state, {mode: STATE_QUOTATION_READ});
            }
          } else if (mode === STATE_QUOTATION_READ) {
            let c = stream.peek();
            if (c === '"') {
              popStack(state);
              stream.next();
              return STYLE_QUOTE;
            } else if (c === '`') {
              replaceStack(state, {mode: STATE_QUOTATION_DETERMINE});
              return STYLE_QUOTE;
            } else if (c === undefined) {
              pushStack(state, {mode: STATE_ERROR});
              return STYLE_QUOTE;
            } else {
              stream.next();
            }
          } else if (mode === STATE_TEXT_BLOCK_OPEN) {
            // Consume left angle hash.
            stream.next();
            stream.next();
            let label = "";
            while (true) {
              let c = stream.next();
              if (c === '>') {
                replaceStack(state, {mode: STATE_TEXT_BLOCK_READ, label: label});
                break;
              } else if (c === ' ') {
                while (true) {
                  let d = stream.next();
                  if (d === 'f' || d === 'h' || d === 'x' || d === 't' || d === 'l' || d === 'n' || d === 'r') {
                    continue;
                  } else if (d === '>') {
                    replaceStack(state, {mode: STATE_TEXT_BLOCK_READ, label: label});
                    break;
                  } else {
                    pushStack(state, {mode: STATE_ERROR});
                    break;
                  }
                }
                break;
              } else if (/\s/.test(c) || c === undefined) {
                pushStack(state, {mode: STATE_ERROR});
                break;
              } else {
                label += c;
              }
            }
          } else if (mode === STATE_TEXT_BLOCK_READ) {
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
          } else if (mode === STATE_BRACKET_OPEN) {
            // Assume left bracket.
            replaceStack(state, {mode: STATE_BRACKET_FIRST});
            stream.next();
            return STYLE_BRACKET;
          } else if (mode === STATE_BRACKET_FIRST) {
            // Skip whitespace. Expect word, quote or other component, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_BRACKET_SECOND});
              if (stream.match(/[a-zA-Z0-9_-]+\s*:/,  false)) { // TODO: Improve this part
                pushStack(state, {mode: STATE_WORD, style: STYLE_KEY}); // Unknown
              } else if (stream.match(/[a-zA-Z0-9_-]+\s*[^:]*/, false)) {
                pushStack(state, {mode: STATE_WORD, style: STYLE_WORD}); // Unknown
              } else {
                pushStack(state, {mode: STATE_WORD, style: STYLE_NULL}); // Unknown
              }
            } else if (t === CLASS_QUOTATION_MARK) {
              replaceStack(state, {mode: STATE_BRACKET_SECOND});
              pushStack(state, {mode: STATE_QUOTATION_OPEN}); // TODO: Determine by lookahead?
            } else if (t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else if (t === CLASS_RIGHT_ANGLE) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_BULLET_DICTIONARY_BULLET});
            } else {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
            }
          } else if (mode === STATE_BRACKET_SECOND) {
            // Skip whitespace. Expect component, colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              pushStack(state, {mode: STATE_FLOW_DICTIONARY_COLON});
            } else {
              replaceStack(state, {mode: STATE_BRACKET_CLOSE});
            }
          } else if (mode === STATE_BRACKET_CLOSE) {
            // Expect right bracket.
            let t = classifyCharacter(stream);
            if (t === CLASS_RIGHT_BRACKET) {
              popStack(state);
              stream.next();
              return STYLE_BRACKET;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_EXPRESSION) {
            // Skip whitespace. Expect component, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_EXPRESSION_SEPARABLE) {
            //
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              replaceStack(state, {mode: STATE_EXPRESSION_SEPARATOR});
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              replaceStack(state, {mode: STATE_EXPRESSION_SEPARATOR});
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              pushStack(state, {mode: STATE_WORD, style: STYLE_WORD});
            } else if (t === CLASS_QUOTATION_MARK) {
              pushStack(state, {mode: STATE_QUOTATION_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE) {
              pushStack(state, {mode: STATE_TAG_OPEN});
            } else if (t === CLASS_TILDE) {
              stream.next();
              return STYLE_OPERATOR;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_EXPRESSION_SEPARATOR) {
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_EXPRESSION_WHITESPACE});
              stream.next();
              return STYLE_CONSTRUCTOR;
            } else {
              replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
            }
          } else if (mode === STATE_EXPRESSION_WHITESPACE) {
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE || t === CLASS_COMMENT_HASH) {
              replaceStack(state, {mode: STATE_EXPRESSION});
            } else {
              replaceStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_FLOW_DICTIONARY_KEY) {
            // Skip whitespace. Expect key or end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_FLOW_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_KEY});
            } else if (t === CLASS_QUOTATION_MARK) {
              replaceStack(state, {mode: STATE_FLOW_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_QUOTATION_OPEN, style: STYLE_KEY});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_FLOW_DICTIONARY_COLON) {
            // Skip whitespace. Expect colon.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_FLOW_DICTIONARY_VALUE});
              stream.next();
              return STYLE_KEY;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_FLOW_DICTIONARY_VALUE) {
            // Skip whitespace. Expect value.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_FLOW_DICTIONARY_SEMICOLON});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_FLOW_DICTIONARY_SEMICOLON) {
            // Skip whitespace. Expect semicolon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_SEMICOLON) {
              replaceStack(state, {mode: STATE_FLOW_DICTIONARY_KEY});
              stream.next();
              return STYLE_PUNCTUATION;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_BULLET_DICTIONARY_BULLET) {
            // Skip whitespace. Expect right angle, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_ANGLE) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_KEY});
              stream.next();
              return STYLE_BULLET;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_BULLET_DICTIONARY_KEY) {
            // Skip whitespace. Expect key.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_KEY});
            } else if (t === CLASS_QUOTATION_MARK) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_QUOTATION_OPEN, style: STYLE_KEY});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_COLON});
              pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN, style: STYLE_KEY});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_BULLET_DICTIONARY_COLON) {
            // Expect colon.
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_VALUE});
              stream.next();
              return STYLE_KEY;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_BULLET_DICTIONARY_VALUE) {
            // Skip whitespace. Expect entry.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_BULLET_DICTIONARY_BULLET});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_SQUARE_OPEN) {
            // Expect left square.
            replaceStack(state, {mode: STATE_SQUARE_CONTENT});
            stream.next();
            return STYLE_BRACKET;
          } else if (mode === STATE_SQUARE_CONTENT) {
            // Skip whitespace. Expect value or bar, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
              pushStack(state, {mode: STATE_FLOW_TABLE_VALUE, lastN: null, thisN: 0});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
              pushStack(state, {mode: STATE_GRID_TABLE_SEPARATOR, lastN: null, thisN: 0});
            } else if (t === CLASS_RIGHT_ANGLE) {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
              pushStack(state, {mode: STATE_BULLET_TABLE_BULLET, lastN: null, thisN: 0});
            } else {
              replaceStack(state, {mode: STATE_SQUARE_CLOSE});
            }
          } else if (mode === STATE_SQUARE_CLOSE) {
            // Skip whitespace. Expect right square.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_SQUARE) {
              popStack(state);
              stream.next();
              return STYLE_BRACKET;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_FLOW_TABLE_VALUE) {
            // Skip whitespace. Expect value.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_FLOW_TABLE_SEPARATOR, lastN: head.lastN, thisN: head.thisN + 1});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_FLOW_TABLE_SEPARATOR) {
            // Skip whitespace. Expect bar or semicolon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_FLOW_TABLE_VALUE, lastN: head.lastN, thisN: head.thisN});
              stream.next();
              return STYLE_PUNCTUATION;
            } else if (t === CLASS_SEMICOLON) {
              if (check_columns(head.lastN, head.thisN)) {
                replaceStack(state, {mode: STATE_FLOW_TABLE_ROW, lastN: head.thisN});
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
          } else if (mode === STATE_FLOW_TABLE_ROW) {
            // Skip whitespace. Expect value, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_FLOW_TABLE_VALUE, lastN: head.lastN, thisN: 0});
            } else {
              popStack(state);
            }
          } else if (mode === STATE_GRID_TABLE_SEPARATOR) {
            // Skip whitespace. Expect bar.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_BAR) {
              replaceStack(state, {mode: STATE_GRID_TABLE_VALUE, lastN: head.lastN, thisN: head.thisN});
              stream.next();
              return STYLE_PUNCTUATION;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_GRID_TABLE_VALUE) {
            // Skip whitespace. Expect value or bar, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_GRID_TABLE_SEPARATOR, lastN: head.lastN, thisN: head.thisN + 1});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else if (t === CLASS_BAR) {
              if (check_columns(head.lastN, head.thisN)) {
                replaceStack(state, {mode: STATE_GRID_TABLE_SEPARATOR, lastN: head.thisN, thisN: 0});
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
          } else if (mode === STATE_BULLET_TABLE_BULLET) {
            // Skip whitespace. Expect right angle or bar, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_ANGLE) {
              if (head.lastN !== null) { // Check lastN = thisN
                if (head.lastN !== head.thisN) {
                  pushStack(state, {mode: STATE_ERROR});
                } else {
                  replaceStack(state, {mode: STATE_BULLET_TABLE_ENTRY, lastN: head.thisN, thisN: 1});
                  stream.next();
                  return STYLE_BULLET;
                }
              } else {
                replaceStack(state, {mode: STATE_BULLET_TABLE_ENTRY, lastN: null, thisN: 1});
                stream.next();
                return STYLE_BULLET;
              }
            } else if (t === CLASS_BAR) {
              if (head.thisN === 0) {
                pushStack(state, {mode: STATE_ERROR});
                continue;
              }
              replaceStack(state, {mode: STATE_BULLET_TABLE_ENTRY, lastN: head.lastN, thisN: head.thisN + 1});
              stream.next();
              return STYLE_BULLET;
            } else {
              if (head.lastN !== null) {
                if (head.lastN !== head.thisN) {
                  pushStack(state, {mode: STATE_ERROR});
                  continue;
                }
              }
              popStack(state);
            }
          } else if (mode === STATE_BULLET_TABLE_ENTRY) {
            // Skip whitespace. Expect entry.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (
                t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_QUOTATION_MARK ||
                t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE
            ) {
              replaceStack(state, {mode: STATE_BULLET_TABLE_BULLET, lastN: head.lastN, thisN: head.thisN});
              pushStack(state, {mode: STATE_EXPRESSION});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_TAG_OPEN) {
            // Expect left angle.
            let t = classifyCharacter(stream);
            if (t === CLASS_LEFT_ANGLE) {
              let macro = false;
              if (stream.match(/<[a-zA-Z0-9_-]*!\s+/, false) || stream.match(/<[a-zA-Z0-9_-]*!>/, false)) { // TODO: Improve this part. Highlights tags ending in ! differently.
                macro = true;
              }
              replaceStack(state, {mode: STATE_TAG_NAME, macro: macro});
              stream.next();
              return macro ? STYLE_MACRO : STYLE_TAG;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_TAG_NAME) {
            // Skip whitespace. Expect command.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_WORD, style: head.macro ? STYLE_MACRO : STYLE_TAG});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_TAG_ATTRIBUTE) {
            // Skip whitespace. Expect attribute, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_TAG_COLON, macro: head.macro});
              pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE});
            } else {
              replaceStack(state, {mode: STATE_TAG_CLOSE, macro: head.macro});
            }
          } else if (mode === STATE_TAG_COLON) {
            // Expect whitespace or colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_TAG_VALUE, macro: head.macro});
              stream.next();
              return head.macro ? STYLE_ATTRIBUTE : STYLE_ATTRIBUTE;
            } else {
              replaceStack(state, {mode: STATE_TAG_CLOSE, macro: head.macro});
            }
          } else if (mode === STATE_TAG_VALUE) {
            // Expect attribute value.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE_VALUE});
            } else if (t === CLASS_QUOTATION_MARK) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_QUOTATION_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro});
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_TAG_CLOSE) {
            // Skip whitespace. Expect right angle.
            let t = classifyCharacter(stream);
            if (t === CLASS_WHITESPACE) {
              pushStack(state, {mode: STATE_WHITESPACE});
            } else if (t === CLASS_COMMENT_HASH) {
              pushStack(state, {mode: STATE_COMMENT});
            } else if (t === CLASS_RIGHT_ANGLE) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              stream.next();
              return head.macro ? STYLE_MACRO : STYLE_TAG;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_PATTERN_COLON) {
            // Expect colon, otherwise end.
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_PATTERN_ARGUMENT});
              stream.next();
              if (stream.eol()) pushStack(state, {mode: STATE_ERROR});
              return STYLE_ARGUMENT_COLON;
            } else {
              popStack(state);
            }
          } else if (mode === STATE_PATTERN_ARGUMENT) {
            // Expect argument.
            let t = classifyCharacter(stream);
            if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              pushStack(state, {mode: STATE_WORD, style: STYLE_WORD_ARGUMENT});
            } else if (t === CLASS_QUOTATION_MARK) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              pushStack(state, {mode: STATE_QUOTATION_OPEN});
            } else if (t === CLASS_LEFT_ANGLE_HASH) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
            } else if (t === CLASS_LEFT_BRACKET) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              pushStack(state, {mode: STATE_BRACKET_OPEN});
            } else if (t === CLASS_LEFT_SQUARE) {
              replaceStack(state, {mode: STATE_PATTERN_COLON});
              pushStack(state, {mode: STATE_SQUARE_OPEN});
            } else if (t === CLASS_LEFT_ANGLE) {
              replaceStack(state, {mode: STATE_TAG_OPEN}); // TODO Maybe?
            } else if (t === CLASS_DIAMOND) {
              replaceStack(state, {mode: STATE_PATTERN_COMPOSE});
              stream.next();
              stream.next();
              return STYLE_OPERATOR;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_PATTERN_COMPOSE) {
            // Expect colon.
            let t = classifyCharacter(stream);
            if (t === CLASS_COLON) {
              replaceStack(state, {mode: STATE_TAG_OPEN}); // TODO Maybe?
              stream.next();
              return STYLE_ARGUMENT_COLON;
            } else {
              pushStack(state, {mode: STATE_ERROR});
            }
          } else if (mode === STATE_ERROR) {
            stream.skipToEnd();
            return STYLE_ERROR;
          }
        }
      }
    };
  });

  CodeMirror.defineMIME('application/khi', 'khi');

});
