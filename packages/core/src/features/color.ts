import colorConvert from 'color-convert';
import {
  ASTBase,
  ASTChunk,
  ASTLiteral,
  ASTPosition,
  ASTType
} from 'miniscript-core';
import type {
  ColorInformation,
  ColorPresentationParams,
  DocumentColorParams,
  Position,
  Range
} from 'vscode-languageserver';

import { IContext } from '../types';

enum ColorType {
  Black = 'black',
  Blue = 'blue',
  Green = 'green',
  Orange = 'orange',
  Purple = 'purple',
  Red = 'red',
  White = 'white',
  Yellow = 'yellow'
}

const ColorMap: {
  [key in ColorType]: string;
} = {
  black: '#000000',
  blue: '#0000FF',
  green: '#00FF00',
  orange: '#FF8800',
  purple: '#CC8899',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00'
};

const createColorRegExp = () =>
  new RegExp(
    `(?:mark|color)=(${Object.keys(ColorMap).join('|')}|(?:#[0-9a-f]{6}|#[0-9a-f]{3}))`,
    'ig'
  );

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function activate(context: IContext) {
  context.connection.onColorPresentation((params: ColorPresentationParams) => {
    return [
      {
        label: `#${colorConvert.rgb.hex(
          params.color.red * 255,
          params.color.green * 255,
          params.color.blue * 255
        )}`
      }
    ];
  });

  context.connection.onDocumentColor(async (params: DocumentColorParams) => {
    const textDocument = await context.fs.getTextDocument(
      params.textDocument.uri
    );

    if (textDocument == null) {
      return;
    }

    const parseResult = await context.documentManager.getLatest(textDocument);
    const chunk = parseResult.document as ASTChunk;
    const allAvailableStrings = chunk.literals.filter(
      (literal: ASTBase) =>
        (literal as ASTLiteral).type === ASTType.StringLiteral
    ) as ASTLiteral[];
    const result: ColorInformation[] = [];
    const getRange = ({
      match,
      markup,
      value,
      astPosition,
      lineIndex
    }: {
      match: RegExpExecArray;
      markup: string;
      value: string;
      astPosition: ASTPosition;
      lineIndex: number;
    }): Range => {
      const colorStartIndex = match.index + markup.indexOf('=') + 1;
      const colorEndIndex = colorStartIndex + value.length;
      const line = astPosition.line - 1 + lineIndex;
      let start = colorStartIndex;
      let end = colorEndIndex;

      if (lineIndex === 0) {
        start += astPosition.character;
        end += astPosition.character;
      }

      const colorStart: Position = {
        line,
        character: start
      };
      const colorEnd: Position = {
        line,
        character: end
      };

      return {
        start: colorStart,
        end: colorEnd
      };
    };

    for (let index = 0; index < allAvailableStrings.length; index++) {
      const strLiteral = allAvailableStrings[index];

      if (!strLiteral.start) continue;

      const start = strLiteral.start;
      const lines = strLiteral.value.toString().split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const regexp = createColorRegExp();
        let match;

        while ((match = regexp.exec(line))) {
          const [markup, value] = match;
          const range = getRange({
            match,
            markup,
            value,
            astPosition: start,
            lineIndex
          });

          if (value.startsWith('#')) {
            const [red, green, blue] = colorConvert.hex.rgb(value.slice(1));

            result.push({
              range,
              color: {
                red: red / 255,
                green: green / 255,
                blue: blue / 255,
                alpha: 1
              }
            });
          } else if (hasOwnProperty.call(ColorMap, value)) {
            const [red, green, blue] = colorConvert.hex.rgb(
              ColorMap[value as ColorType].slice(1)
            );

            result.push({
              range,
              color: {
                red: red / 255,
                green: green / 255,
                blue: blue / 255,
                alpha: 1
              }
            });
          } else {
            result.push({
              range,
              color: {
                red: 0,
                green: 0,
                blue: 0,
                alpha: 1
              }
            });
          }
        }
      }
    }

    return result;
  });
}
