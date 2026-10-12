// Everything the passages do not use is switched off so its syntax stays
// plain text on both sides of the trip: no links, images, code blocks, rules,
// setext headings, entities or html. A stored `&amp;` stays `&amp;`.
export const PARSE_OPTIONS = {
  extensions: [{
    disable: {
      null: [
        'autolink', 'labelStartLink', 'labelStartImage', 'labelEnd', 'definition',
        'codeIndented', 'codeFenced', 'htmlFlow', 'htmlText',
        'thematicBreak', 'setextUnderline', 'characterReference',
      ],
    },
  }],
};

// Only article import opts into inline citation links; stored legacy passages
// keep their original text and offsets. Images/references/autolinks stay literal.
export const LINK_PARSE_OPTIONS={extensions:[{disable:{null:PARSE_OPTIONS.extensions[0].disable.null.filter(name=>!['labelStartLink','labelEnd'].includes(name))}}]};

