export const TERMINAL_OUTPUT_MAX_BYTES=4*1024*1024;
export const TERMINAL_OUTPUT_TAIL_BYTES=2*1024*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const byteLength=text=>typeof Buffer==='function'?Buffer.byteLength(text):encoder.encode(text).length;
// One byte boundary for persisted/replayed PTY output and the React transcript.
// A suffix starts at a complete UTF-8 code point, never in the middle of a glyph.
export function boundedTerminalTranscript(output){
 if(byteLength(output)<=TERMINAL_OUTPUT_MAX_BYTES)return output;
 const bytes=encoder.encode(output);let start=bytes.length-TERMINAL_OUTPUT_TAIL_BYTES;
 while(start<bytes.length&&(bytes[start]&0xc0)===0x80)start++;
 return decoder.decode(bytes.subarray(start));
}
