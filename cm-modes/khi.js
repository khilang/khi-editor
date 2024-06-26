(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

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
      CLASS_BACKSLASH = "backslash",
      CLASS_COLON = "colon",
      CLASS_SEMICOLON = "semicolon",
      CLASS_BAR = "bar",
      CLASS_AMPERSAND = "ampersand",
      CLASS_TILDE = "tilde",
      CLASS_ERROR = "error";

  const
      STATE_WHITESPACE = "whitespace",
      STATE_COMMENT = "comment",
      STATE_WORD = "word",
      STATE_CHARACTER_ESCAPE_SEQUENCE = "character-escape-sequence",
      STATE_REPEATED_ESCAPE_SEQUENCE = "repeated-escape-sequence",
      STATE_TRANSCRIPTION_OPEN = "transcription::open",
      STATE_TRANSCRIPTION_DETERMINE = "transcription::determine",
      STATE_TRANSCRIPTION_READ = "transcription::read",
      STATE_TEXT_BLOCK_OPEN = "text-block::open",
      STATE_TEXT_BLOCK_READ = "text-block::read",
      STATE_BRACKET_OPEN = "bracket::open",
      STATE_BRACKET_FIRST = "bracket::first",
      STATE_BRACKET_SECOND = "bracket::second",
      STATE_BRACKET_CLOSE = "bracket::close",
      STATE_EXPRESSION = "expression",
      STATE_EXPRESSION_TERM = "expression::term",
      STATE_EXPRESSION_SEPARABLE = "expression::separable",
      STATE_EXPRESSION_INSEPARABLE = "expression::inseparable",
      STATE_EXPRESSION_TAG_EXPRESSABLE = "expression::tag-expressable",
      STATE_DICTIONARY = "dictionary",
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
      STATE_TABLE = "table",
      STATE_FLOW_TABLE_VALUE = "flow-table::value",
      STATE_FLOW_TABLE_SEPARATOR = "flow-table::separator",
      STATE_FLOW_TABLE_ROW = "flow-table::row",
      STATE_GRID_TABLE_SEPARATOR = "grid-table::separator",
      STATE_GRID_TABLE_VALUE = "grid-table::value",
      STATE_BULLET_TABLE_BULLET = "bullet-table::bullet",
      STATE_BULLET_TABLE_ENTRY = "bullet-table::entry",
      STATE_TUPLE = "tuple",
      STATE_TAG_OPEN = "tag::open",
      STATE_TAG_NAME = "tag::name",
      STATE_TAG_ATTRIBUTE = "tag::attribute",
      STATE_TAG_COLON = "tag::colon",
      STATE_TAG_VALUE = "tag::value",
      STATE_TAG_CLOSE = "tag::close",
      STATE_ARGUMENTS_COLON = "arguments::colon",
      STATE_ARGUMENTS_ARGUMENT = "arguments::argument",
      STATE_COMPOSE = "compose",
      STATE_COMPOSABLE = "composable",
      STATE_ERROR = "error";

  const
      STYLE_NULL = "null",
      STYLE_COMMENT = "comment",
      STYLE_TRANSCRIPTION = "string",
      STYLE_WORD = "text",
      STYLE_WORD_ARGUMENT = "def",
      STYLE_ATTRIBUTE_VALUE = "attribute",
      STYLE_ESCAPED = "variable",
      STYLE_BRACKET = "bracket",
      STYLE_PUNCTUATION = "bracket",
      STYLE_BULLET = "bracket",
      STYLE_TUPLE = "variable-2",
      STYLE_CONTRACTION = "builtin",
      STYLE_COMPOSITION = "bracket",
      STYLE_KEY = "keyword",
      STYLE_ATTRIBUTE = "attribute",
      STYLE_TAG = "tag",
      STYLE_ARGUMENT_COLON = "tag",
      STYLE_MACRO = "type",
      STYLE_ERROR = "error";

  function defm(start_state) {
    return function() {

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
            c === '{' || c === '}' || c === '[' || c === ']' || c === '<' || c === '>' ||
            c === ':' || c === ';' || c === '|' || c === '&' || c === '~' || c === '`' ||
            c === '\\' || c === '#' || c === 'n' || c === 't'
        );
      }

      function classifyCharacter(stream) {
        let c = stream.next();
        let d = c !== undefined ? stream.next() : undefined;
        let e = d !== undefined ? stream.next() : undefined;
        c = c === undefined ? null : c;
        d = d === undefined ? null : d;
        e = e === undefined ? null : e;
        if (c !== null) stream.backUp(1);
        if (d !== null) stream.backUp(1);
        if (e !== null) stream.backUp(1);
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
        } else if (c === ':') {
          return d === ':' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_COLON;
        } else if (c === ';') {
          return d === ';' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_SEMICOLON;
        } else if (c === '|') {
          return d === '|' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_BAR;
        } else if (c === '&') {
          return d === '&' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_AMPERSAND;
        } else if (c === '~') {
          return d === '~' ? CLASS_REPEATED_ESCAPE_SEQUENCE : CLASS_TILDE;
        } else if (c === '`') {
          return CLASS_CHARACTER_ESCAPE_SEQUENCE;
        } else if (c === '\\') {
          return CLASS_BACKSLASH;
        } else if (c === '#') {
          if (d === '#' || d === ' ' || d === '\t' || d === '\n' || d === null) {
            return CLASS_COMMENT_HASH;
          } else if (d === '{' || d === '}' || d === '[' || d === ']' || d === '\\') {
            return CLASS_ERROR;
          } else if (d === '<' || d === '>' || d === ':' || d === ';' || d === '|' || d === '&') {
            if (e === d) {
              return CLASS_COMMENT_HASH;
            } else {
              return CLASS_ERROR;
            }
          } else {
            return CLASS_GLYPH;
          }
        } else if (c === ' ' || c === '\t' || c === '\n' || c === null) {
          return CLASS_WHITESPACE;
        } else {
          return CLASS_GLYPH;
        }
      }

      function matches_expression(t) {
        return matches_term(t) || t === CLASS_AMPERSAND
      }

      function matches_term(t) {
        return t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE ||
            t === CLASS_BACKSLASH || t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET ||
            t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE ||
            t === CLASS_DIAMOND
      }

      return {
        startState: function () {
          return {
            stack: structuredClone(start_state),
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
            /////////////// console.log(mode, classifyCharacter(stream)); ///////////////
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
              stream.next();
              let d = stream.next();
              if (isValidEscape(d)) {
                popStack(state);
                return STYLE_ESCAPED;
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_REPEATED_ESCAPE_SEQUENCE) {
              popStack(state);
              stream.next();
              stream.next();
              return STYLE_ESCAPED;
            } else if (mode === STATE_TRANSCRIPTION_OPEN) {
              // Assume backslash.
              replaceStack(state, {mode: STATE_TRANSCRIPTION_READ});
              stream.next();
            } else if (mode === STATE_TRANSCRIPTION_DETERMINE) {
              // Expect backslash, escape character or regular character.
              if (stream.sol() || stream.eol()) {
                popStack(state);
                continue;
              }
              let c = stream.peek();
              if (c === '\\') {
                replaceStack(state, {mode: STATE_TRANSCRIPTION_READ});
              } else if (c === '`') {
                if (classifyCharacter(stream) === CLASS_CHARACTER_ESCAPE_SEQUENCE) {
                  pushStack(state, {mode: STATE_CHARACTER_ESCAPE_SEQUENCE});
                } else {
                  pushStack(state, {mode: STATE_ERROR});
                }
              } else {
                replaceStack(state, {mode: STATE_TRANSCRIPTION_READ});
              }
            } else if (mode === STATE_TRANSCRIPTION_READ) {
              let c = stream.peek();
              if (c === '\\') {
                popStack(state);
                stream.next();
                return STYLE_TRANSCRIPTION;
              } else if (c === '`') {
                replaceStack(state, {mode: STATE_TRANSCRIPTION_DETERMINE});
                return STYLE_TRANSCRIPTION;
              } else if (c === undefined) {
                popStack(state);
                return STYLE_TRANSCRIPTION;
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
                  return STYLE_TRANSCRIPTION;
                } else {
                  if (stream.next() === undefined) {
                    return STYLE_TRANSCRIPTION;
                  }
                }
              }
            } else if (mode === STATE_BRACKET_OPEN) {
              // Assume left bracket.
              replaceStack(state, {mode: STATE_BRACKET_FIRST});
              stream.next();
              return STYLE_BRACKET;
            } else if (mode === STATE_BRACKET_FIRST) {
              // Skip whitespace. Expect word, backslash or other term, otherwise end.
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
              } else if (t === CLASS_BACKSLASH) {
                replaceStack(state, {mode: STATE_BRACKET_SECOND});
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN});
              } else if (t === CLASS_LEFT_ANGLE_HASH) {
                replaceStack(state, {mode: STATE_BRACKET_SECOND});
                pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
              } else if (t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_AMPERSAND || t === CLASS_TILDE || t === CLASS_DIAMOND) {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE});
                pushStack(state, {mode: STATE_EXPRESSION});
              } else if (t === CLASS_RIGHT_ANGLE) {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE});
                pushStack(state, {mode: STATE_BULLET_DICTIONARY_BULLET});
              } else {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE});
              }
            } else if (mode === STATE_BRACKET_SECOND) {
              // Skip whitespace. Expect term, colon, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE});
                pushStack(state, {mode: STATE_EXPRESSION_TERM});
              } else if (t === CLASS_COMMENT_HASH) {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE});
                pushStack(state, {mode: STATE_EXPRESSION_TERM});
              } else if (matches_term(t)) {
                replaceStack(state, {mode: STATE_BRACKET_CLOSE}); // todo Tilde somwhere
                pushStack(state, {mode: STATE_EXPRESSION_TERM});
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
              // Skip whitespace. Expect term or colon, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (
                  t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_BACKSLASH ||
                  t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_TILDE
              ) {
                replaceStack(state, {mode: STATE_EXPRESSION_TERM});
              } else if (t === CLASS_LEFT_ANGLE) {
                replaceStack(state, {mode: STATE_EXPRESSION_TAG_EXPRESSABLE});
                pushStack(state, {mode: STATE_TAG_OPEN, argument: true, style: stream.match(/<[\sA-Za-z0-9]*>:\s+/, false) ? STYLE_TUPLE : STYLE_TAG});
              } else if (t === CLASS_DIAMOND) {
                replaceStack(state, {mode: STATE_EXPRESSION_TAG_EXPRESSABLE});
                pushStack(state, {mode: STATE_TUPLE, argument: true, style: stream.match(/<[\sA-Za-z0-9]*>:\s+/, false) ? STYLE_TUPLE : STYLE_TAG});
              } else if (t === CLASS_AMPERSAND) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
                stream.next();
                return STYLE_TUPLE;
              } else {
                popStack(state);
              }
            } else if (mode === STATE_EXPRESSION_TAG_EXPRESSABLE) {
              if (stream.match(/:\s+/)) {
                replaceStack(state, {mode: STATE_EXPRESSION});
                return STYLE_TUPLE;
              } else if (stream.match(/:/, false)) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
                pushStack(state, {mode: STATE_COMPOSE});
                pushStack(state, {mode: STATE_ARGUMENTS_COLON});
              } else {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
              }
            } else if (mode === STATE_EXPRESSION_TERM) {
              //
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
              } else if (t === CLASS_COMMENT_HASH) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
              } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                pushStack(state, {mode: STATE_WORD, style: STYLE_WORD});
              } else if (t === CLASS_BACKSLASH) {
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN});
              } else if (t === CLASS_LEFT_ANGLE_HASH) {
                pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
              } else if (t === CLASS_LEFT_BRACKET) {
                pushStack(state, {mode: STATE_BRACKET_OPEN});
              } else if (t === CLASS_LEFT_SQUARE) {
                pushStack(state, {mode: STATE_SQUARE_OPEN});
              } else if (t === CLASS_DIAMOND) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE}); // TODO: Make this less confusing
                pushStack(state, {mode: STATE_TUPLE, argument: false})
              } else if (t === CLASS_LEFT_ANGLE) {
                replaceStack(state, {mode: STATE_EXPRESSION_SEPARABLE});
                pushStack(state, {mode: STATE_TAG_OPEN, argument: false});
              } else if (t === CLASS_TILDE) {
                stream.next();
                return STYLE_CONTRACTION;
              } else if (t === CLASS_AMPERSAND) { // TODO: Maybe better way?
                replaceStack(state, {mode: STATE_EXPRESSION_INSEPARABLE});
                stream.next();
                return STYLE_TUPLE;
              } else {
                popStack(state);
              }
            } else if (mode === STATE_EXPRESSION_SEPARABLE) {
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (
                  t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_BACKSLASH ||
                  t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE || t === CLASS_DIAMOND
              ) {
                replaceStack(state, {mode: STATE_EXPRESSION_TERM});
              } else if (t === CLASS_AMPERSAND) { // TODO: Warn on tuple colon not on first line
                replaceStack(state, {mode: STATE_EXPRESSION_INSEPARABLE});
                stream.next();
                return STYLE_TUPLE;
              } else {
                popStack(state);
              }
            } else if (mode === STATE_EXPRESSION_INSEPARABLE) {
              // Skip whitespace. Ensure there is a term next.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (
                  t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE || t === CLASS_BACKSLASH ||
                  t === CLASS_LEFT_ANGLE_HASH || t === CLASS_LEFT_BRACKET || t === CLASS_LEFT_SQUARE || t === CLASS_LEFT_ANGLE || t === CLASS_TILDE || t === CLASS_DIAMOND
              ) {
                replaceStack(state, {mode: STATE_EXPRESSION_TERM});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_DICTIONARY) {
              // Skip whitespace. Expect word, backslash or other term, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (
                  t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE ||
                  t === CLASS_BACKSLASH || t === CLASS_LEFT_ANGLE_HASH
              ) {
                replaceStack(state, {mode: STATE_FLOW_DICTIONARY_KEY});
              } else if (t === CLASS_RIGHT_ANGLE) {
                replaceStack(state, {mode: STATE_BULLET_DICTIONARY_BULLET});
              } else {
                popStack(state);
              }
            } else if (mode === STATE_FLOW_DICTIONARY_KEY) {
              // Skip whitespace. Expect key or end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_FLOW_DICTIONARY_COLON}); // TODO No space between key & colon
                pushStack(state, {mode: STATE_WORD, style: STYLE_KEY});
              } else if (t === CLASS_BACKSLASH) { //TODO Block
                replaceStack(state, {mode: STATE_FLOW_DICTIONARY_COLON});
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN, style: STYLE_KEY});
              } else {
                popStack(state);
              }
            } else if (mode === STATE_FLOW_DICTIONARY_COLON) {
              // Skip whitespace. Expect colon.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE}); // TODO No whitespace
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
              } else if (matches_expression(t)) {
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
              } else if (t === CLASS_BACKSLASH) {
                replaceStack(state, {mode: STATE_BULLET_DICTIONARY_COLON});
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN, style: STYLE_KEY});
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
              } else if (matches_expression(t)) {
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
              } else if (matches_expression(t)) {
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
            } else if (mode === STATE_TABLE) {
              // Skip whitespace. Expect value or bar, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (matches_expression(t)) {
                replaceStack(state, {mode: STATE_FLOW_TABLE_VALUE, lastN: null, thisN: 0});
              } else if (t === CLASS_BAR) {
                replaceStack(state, {mode: STATE_GRID_TABLE_SEPARATOR, lastN: null, thisN: 0});
              } else if (t === CLASS_RIGHT_ANGLE) {
                replaceStack(state, {mode: STATE_BULLET_TABLE_BULLET, lastN: null, thisN: 0});
              } else {
                popStack(state);
              }
            } else if (mode === STATE_FLOW_TABLE_VALUE) {
              // Skip whitespace. Expect value.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (matches_expression(t)) {
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
              } else if (matches_expression(t)) {
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
              } else if (matches_expression(t)) {
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
              } else if (matches_expression(t)) {
                replaceStack(state, {mode: STATE_BULLET_TABLE_BULLET, lastN: head.lastN, thisN: head.thisN});
                pushStack(state, {mode: STATE_EXPRESSION});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_TUPLE) {
              if (head.style === undefined) head.style = STYLE_TAG;
              let t = classifyCharacter(stream);
              if (t === CLASS_DIAMOND) {
                if (!head.argument) {
                  replaceStack(state, {mode: STATE_COMPOSE});
                  pushStack(state, {mode: STATE_ARGUMENTS_COLON});
                } else {
                  popStack(state);
                }
                stream.next(); stream.next();
                return head.style;
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_TAG_OPEN) {
              // Expect left angle.
              if (head.style === undefined) head.style = STYLE_TAG;
              let t = classifyCharacter(stream);
              if (t === CLASS_LEFT_ANGLE) {
                let macro = false;
                if (stream.match(/<[a-zA-Z0-9_-]*!\s+/, false) || stream.match(/<[a-zA-Z0-9_-]*!>/, false)) { // TODO: Improve this part. Highlights tags ending in ! differently.
                  macro = true;
                }
                replaceStack(state, {mode: STATE_TAG_NAME, macro: macro, argument: head.argument, style: head.style});
                stream.next();
                if (stream.eol()) {
                  pushStack(state, {mode: STATE_ERROR});
                }
                return macro ? STYLE_MACRO : head.style;
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_TAG_NAME) {
              // Expect name.
              let t = classifyCharacter(stream);
              if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_WORD, style: head.macro ? STYLE_MACRO : head.style});
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_TAG_ATTRIBUTE) { // TODO: Fix whitespace not allowed in tag production "<"name">"
              // Skip whitespace. Expect attribute, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_TAG_COLON, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE});
              } else {
                replaceStack(state, {mode: STATE_TAG_CLOSE, macro: head.macro, argument: head.argument, style: head.style});
              }
            } else if (mode === STATE_TAG_COLON) {
              // Expect whitespace or colon, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_COMMENT});
              } else if (t === CLASS_COLON) {
                replaceStack(state, {mode: STATE_TAG_VALUE, macro: head.macro, argument: head.argument, style: head.style});
                stream.next();
                return head.macro ? STYLE_ATTRIBUTE : STYLE_ATTRIBUTE;
              } else {
                replaceStack(state, {mode: STATE_TAG_CLOSE, macro: head.macro, argument: head.argument, style: head.style});
              }
            } else if (mode === STATE_TAG_VALUE) {
              // Expect attribute value.
              let t = classifyCharacter(stream);
              if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_WORD, style: STYLE_ATTRIBUTE_VALUE});
              } else if (t === CLASS_BACKSLASH) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN});
              } else if (t === CLASS_LEFT_ANGLE_HASH) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
              } else if (t === CLASS_LEFT_BRACKET) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
                pushStack(state, {mode: STATE_BRACKET_OPEN});
              } else if (t === CLASS_LEFT_SQUARE) {
                replaceStack(state, {mode: STATE_TAG_ATTRIBUTE, macro: head.macro, argument: head.argument, style: head.style});
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
                if (!head.argument) {
                  replaceStack(state, {mode: STATE_COMPOSE});
                  pushStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                } else {
                  popStack(state);
                }
                stream.next();
                return head.macro ? STYLE_MACRO : head.style;
              } else {
                pushStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_ARGUMENTS_COLON) {
              // Expect colon, otherwise end.
              let t = classifyCharacter(stream);
              if (t === CLASS_COLON) {
                replaceStack(state, {mode: STATE_ARGUMENTS_ARGUMENT, macro: head.macro});
                stream.next();
                if (stream.eol()) pushStack(state, {mode: STATE_ERROR});
                return head.macro ? STYLE_MACRO : STYLE_ARGUMENT_COLON;
              } else {
                popStack(state);
              }
            } else if (mode === STATE_ARGUMENTS_ARGUMENT) {
              // Expect argument.
              let t = classifyCharacter(stream);
              if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_WORD, style: STYLE_WORD_ARGUMENT});
              } else if (t === CLASS_BACKSLASH) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_TRANSCRIPTION_OPEN});
              } else if (t === CLASS_LEFT_ANGLE_HASH) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
              } else if (t === CLASS_LEFT_BRACKET) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_BRACKET_OPEN});
              } else if (t === CLASS_LEFT_SQUARE) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_SQUARE_OPEN});
              } else if (t === CLASS_LEFT_ANGLE) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_TAG_OPEN, argument: true});
              } else if (t === CLASS_DIAMOND) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                pushStack(state, {mode: STATE_TUPLE, argument: true});
              } else if (t === CLASS_AMPERSAND) {
                replaceStack(state, {mode: STATE_ARGUMENTS_COLON, macro: head.macro});
                stream.next();
                return STYLE_COMPOSITION;
              } else {
                replaceStack(state, {mode: STATE_ERROR});
              }
            } else if (mode === STATE_COMPOSE) {
              // Skip whitespace. Expect tag or tuple.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else {
                popStack(state);
              }
            } else if (mode === STATE_COMPOSABLE) {
              // Skip whitespace. Expect tag or tuple.
              let t = classifyCharacter(stream);
              if (t === CLASS_WHITESPACE) {
                pushStack(state, {mode: STATE_WHITESPACE});
              } else if (t === CLASS_COMMENT_HASH) {
                pushStack(state, {mode: STATE_COMMENT});
              } else if (t === CLASS_GLYPH || t === CLASS_CHARACTER_ESCAPE_SEQUENCE || t === CLASS_REPEATED_ESCAPE_SEQUENCE) {
                replaceStack(state, {mode: STATE_WORD, style: STYLE_WORD_ARGUMENT});
              } else if (t === CLASS_BACKSLASH) {
                replaceStack(state, {mode: STATE_TRANSCRIPTION_OPEN});
              } else if (t === CLASS_LEFT_ANGLE_HASH) {
                replaceStack(state, {mode: STATE_TEXT_BLOCK_OPEN});
              } else if (t === CLASS_LEFT_BRACKET) {
                replaceStack(state, {mode: STATE_BRACKET_OPEN});
              } else if (t === CLASS_LEFT_SQUARE) {
                replaceStack(state, {mode: STATE_SQUARE_OPEN});
              } else if (t === CLASS_DIAMOND) {
                replaceStack(state, {mode: STATE_TUPLE, argument: false});
              } else if (t === CLASS_LEFT_ANGLE) {
                replaceStack(state, {mode: STATE_TAG_OPEN, argument: false});
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
    };
  }
  CodeMirror.defineMode("khi-expression", defm([{mode: STATE_EXPRESSION}]))
  CodeMirror.defineMode("khi-dictionary", defm([{mode: STATE_DICTIONARY}]))
  CodeMirror.defineMode("khi-table", defm([{mode: STATE_TABLE}]))

  CodeMirror.defineMIME('application/khi', 'khi-expression');
  CodeMirror.defineMIME('application/khi-expression', 'khi-expression');
  CodeMirror.defineMIME('application/khi-dictionary', 'khi-dictionary');
  CodeMirror.defineMIME('application/khi-table', 'khi-table');

});
