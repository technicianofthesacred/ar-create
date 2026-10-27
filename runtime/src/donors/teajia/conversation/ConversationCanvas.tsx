// Adapted renderer closure from Teajia ConversationArticle: real blocks/cover,
// local host provider; original router, publication and site effects excluded.
import React, {createContext,useContext} from 'react';
import type {JSONContent} from '@tiptap/core';
import {AcceptedProse} from '../../../workspaces/AcceptedProse';
import type {RecordedConversationSpec} from '../../../workspaces/compositionSpec';
const RecordedPassages=createContext(new Map<string,JSONContent>());
import EditablePhoto from '../EditablePhoto';
import {EditableText} from '../storyEdit';
import {Rich} from './RichText';
import {type Block,type ConversationSpec,type LineSize,type Part,type Shot,turnStarts} from './spec';
import './conversation.css';
const partWord=(n:number)=>String(n);
const grainCss=(_a:string,_b:number)=>({});
const ChapterHead=({id,title,titleId}:{part:number;id:string;title:string;titleId?:string})=><header id={id} className="tj-conv-col"><Passage id={titleId} text={title} className="tj-conv-spread-title" as="h2"/></header>;
/** Rich/source nodes stay authoritative for every role, including cover and close. */
const Passage: React.FC<{id?:string;text:string;className?:string;as?:keyof React.JSX.IntrinsicElements;style?:React.CSSProperties}> = ({id,text,className,as='p',style}) => {
 const recorded=useContext(RecordedPassages),document=id?recorded.get(id):undefined;
 return document?<div className={className} data-recorded-passage={id} style={style}><AcceptedProse paragraphId={id!} document={document}/></div>:<Rich field={id||'unrecorded'} text={text} className={className} as={as} style={style}/>;
};
const recordedStyle=`.ar-donor-workspace .tj-conv [data-recorded-passage]::before,.ar-donor-workspace .tj-conv [data-recorded-passage]::after{content:none!important}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose{font:inherit;line-height:inherit;color:inherit;margin:0}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose>blockquote{border:0;padding:0;margin:0;color:inherit;font:inherit}
.ar-output-reader .tj-conv [data-recorded-passage]>.ar-recorded-prose>blockquote[data-source-ref]{border-left:2px solid var(--tj-gold);padding-left:1em}
.ar-output-reader .tj-conv .tj-conv-spread-title .ar-recorded-prose :is(h1,h2,h3){font:inherit;color:inherit;line-height:inherit;margin:0}
.ar-output-reader .tj-conv :is(.tj-conv-cover-hook,.tj-conv-line,.tj-conv-onphoto-words) .ar-recorded-prose strong{font-weight:400;color:var(--tj-gold-lt,var(--tj-read-gold-lt-default))}
.ar-output-reader .tj-conv [data-recorded-passage] .ar-recorded-prose p{font:inherit;line-height:inherit}`;

// ── Photographs ──────────────────────────────────────────────────────────────
const Photo: React.FC<{ spec: ConversationSpec; shot: Shot; aspect?: string; fill?: boolean }> = ({ spec, shot, aspect = '4/5', fill }) => (
  <EditablePhoto
    slot={shot.slot}
    alt={shot.alt}
    aspect={aspect}
    fill={fill}
    bare
    defaultPhoto={{ url: spec.images + shot.file, x: shot.x, y: shot.y }}
  />
);

// ── Speakers ─────────────────────────────────────────────────────────────────
type Speakers = { author: string; subject: string; starts: Set<string>; named: boolean };
const SpeakerCtx = createContext<Speakers>({ author: '', subject: '', starts: new Set(), named: true });

/** A speaker's name, hung in the margin on a wide screen and set above the turn on a phone. */
const Who: React.FC<{ name: string }> = ({ name }) => (
  <span className="tj-conv-who">{name}<span className="tj-sr-only">: </span></span>
);

// ── Blocks ───────────────────────────────────────────────────────────────────
/** Consecutive questions, answers and lines of Adrian's telling share one reading column. */
function groupRuns(blocks: Block[]): (Block | Block[])[] {
  const out: (Block | Block[])[] = [];
  blocks.forEach((b) => {
    const last = out[out.length - 1];
    if (b.kind === 'q' || b.kind === 'a' || b.kind === 'n') {
      if (Array.isArray(last)) last.push(b);
      else out.push([b]);
    } else out.push(b);
  });
  return out;
}

/** A sentence of his set large. */
const Line: React.FC<{ id: string; text: string; size: LineSize; follow?: { id: string; text: string } }> = ({ id, text, size, follow }) => {
  const { subject, starts } = useContext(SpeakerCtx);
  const line = (
  <div data-size={size}>
    <Passage id={id} text={text} className="tj-conv-line" />
    {follow && <Passage id={follow.id} text={follow.text} className="tj-conv-a tj-conv-follow" />}
  </div>
  );
  // A large line that opens his answer carries his name, like any turn.
  return starts.has(id) ? <div className="tj-conv-turn"><Who name={subject} />{line}</div> : line;
};

/** Words inside a column, a side or a glyph block. Each turn carries its speaker's name. */
const Words: React.FC<{spec: ConversationSpec;blocks: Block[];depth?:number}> = ({spec,blocks,depth=0}) => {
  if(!Array.isArray(blocks)||blocks.length>2000||depth>8)throw Error('Unsupported nested article blocks.');
  const { author, subject, starts, named } = useContext(SpeakerCtx);
  return (
    <>
      {blocks.map((b, i) => {
        if(!b||typeof b.kind!=='string')throw Error('Unsupported article block.');
        if (b.kind === 'q') {
          return (
            <div key={b.id} className="tj-conv-turn tj-conv-q">
              {named && <Who name={author} />}
              <Passage id={b.id} text={b.text} className="tj-conv-q-text" />
            </div>
          );
        }
        if (b.kind === 'a') {
          return starts.has(b.id)
            ? <div key={b.id} className="tj-conv-turn"><Who name={subject} /><Passage id={b.id} text={b.text} className="tj-conv-a" /></div>
            : <Passage key={b.id} id={b.id} text={b.text} className="tj-conv-a" />;
        }
        // Adrian telling the story: his own voice, set apart from the subject's words by tone, not by a name.
        if (b.kind === 'n') return <Passage key={b.id} id={b.id} text={b.text} className="tj-conv-told" />;
        if (b.kind === 'line') return <Line key={b.id} id={b.id} text={b.text} size={b.size} follow={b.follow} />;
        return <BlockView key={i} spec={spec} block={b} depth={depth}/>;
      })}
    </>
  );
};

/** Canonical AR Create annotation strings stay literal; upstream rich captions keep their existing semantics. */
const PhotoCaption=({caption,credit}:{caption?:{id:string;text:string;literal?:boolean};credit?:string})=>caption?.literal||credit?((caption?.text||credit)?<figcaption className="tj-conv-caption">{caption?.text&&<span>{caption.text}</span>}{caption?.text&&credit&&<br/>}{credit&&<span className="tj-conv-photo-credit">{credit}</span>}</figcaption>:null):caption?<Rich field={caption.id} text={caption.text} as="figcaption" className="tj-conv-caption"/>:null;

/** Keep unannotated compositions identical; explicit wording stays below its own photo. */
const CaptionedPhotoFrame: React.FC<{shot: Shot;className: string;style?: React.CSSProperties;children: React.ReactNode}> = ({shot,className,style,children}) => shot.caption?.text||shot.photoCredit
  ? <figure data-reveal="photo" data-annotated-photo="true" className={className} style={style}><div className="tj-conv-annotated-photo-frame">{children}</div><PhotoCaption caption={shot.caption} credit={shot.photoCredit}/></figure>
  : <div data-reveal="photo" className={className} style={style}>{children}</div>;

const BlockView: React.FC<{spec: ConversationSpec;block: Block | Block[];depth?:number}> = ({spec,block,depth=0}) => {
  if(depth>8)throw Error('Unsupported nested article blocks.');
  if (Array.isArray(block)) {
    return <section data-reveal="text" className="tj-conv-col"><Words spec={spec} blocks={block} depth={depth} /></section>;
  }
  const b = block;
  if(!b||typeof b.kind!=='string')throw Error('Unsupported article block.');
  switch (b.kind) {
    case 'line':
      return <div data-reveal="text" className="tj-conv-spine"><Line id={b.id} text={b.text} size={b.size} follow={b.follow} /></div>;
    case 'side':
      return (
        <section className="tj-conv-side" data-flip={b.flip ? '' : undefined} data-bleed={b.bleed ? '' : undefined}>
          <div data-reveal="text" className="tj-conv-side-words"><Words spec={spec} blocks={b.blocks} depth={depth+1} /></div>
          <CaptionedPhotoFrame shot={b.shot} className="tj-conv-side-photo"><Photo spec={spec} shot={b.shot} /></CaptionedPhotoFrame>
        </section>
      );
    case 'photos':
      return (
        <figure data-reveal="photo" className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined}>
          <div className="tj-conv-photos" data-stagger={b.stagger ? '' : undefined}>
            {b.shots.map((s) => <div key={s.slot}><Photo spec={spec} shot={s} aspect={b.aspect} /></div>)}
          </div>
          <PhotoCaption caption={b.caption} credit={b.photoCredit}/>
        </figure>
      );
    case 'wide':
      return (
        <figure data-reveal="photo" className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined} data-offset={b.offset}>
          <Photo spec={spec} shot={b.shot} aspect={b.aspect ?? '3/2'} /><PhotoCaption caption={b.caption} credit={b.photoCredit}/>
        </figure>
      );
    case 'bleed':
      return <figure data-reveal="photo" className="tj-conv-bleed"><Photo spec={spec} shot={b.shot} fill /><PhotoCaption caption={b.caption} credit={b.photoCredit}/></figure>;
    case 'on-photo':
      return (
        <figure data-reveal="photo" className="tj-conv-onphoto">
          <div className="tj-conv-onphoto-frame" style={{ aspectRatio: b.aspect }}>
            <Photo spec={spec} shot={b.shot} fill />
            <Passage id={b.id} text={b.text} className="tj-conv-onphoto-words" style={{ color: b.ink, ['--tj-gold-lt' as string]: b.accent } as React.CSSProperties} />
          </div>
        </figure>
      );
    case 'glyph':
      return (
        <section data-reveal="text" className="tj-conv-col">
          <div className="tj-conv-glyph">
            <div aria-hidden="true" className="tj-conv-glyph-mark">{b.glyph}</div>
            <div><Words spec={spec} blocks={b.blocks} depth={depth+1} /></div>
          </div>
        </section>
      );
    default:
      throw Error('Unsupported article block.');
  }
};

// ── Part openings ────────────────────────────────────────────────────────────
/** A part opens as a spread: the photograph on one side, the part and its title on the other. */
const PartOpening: React.FC<{ spec: ConversationSpec; part: Part; n: number; titleId?:string }> = ({ spec, part, n, titleId }) => {
  if (!part.opener) return <ChapterHead part={n} id={`part-${n}`} title={part.title} titleId={titleId} />;
  return (
    <section id={`part-${n}`} className="tj-conv-spread" data-flip={n % 2 === 0 ? '' : undefined} aria-labelledby={`part-${n}-title`}>
      <CaptionedPhotoFrame shot={part.opener} className="tj-conv-spread-photo"><Photo spec={spec} shot={part.opener} fill /></CaptionedPhotoFrame>
      <header data-reveal="text" className="tj-conv-spread-head">
        {spec.form !== 'story' && <span className="tj-conv-spread-part">Part {partWord(n)}</span>}
        <div id={`part-${n}-title`}><Passage id={titleId} text={part.title} as="h2" className="tj-conv-spread-title"/></div>
        <span aria-hidden="true" className="tj-conv-spread-rule" />
      </header>
    </section>
  );
};

// ── Cover and byline ─────────────────────────────────────────────────────────
/** The hook in the story form, the dek otherwise: the words under the title on either cover. */
const CoverWords: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (spec.form === 'story' && (spec.hook || (spec as Partial<RecordedConversationSpec>).recordedFields?.hookId)
  ? <Passage id={(spec as Partial<RecordedConversationSpec>).recordedFields?.hookId} text={spec.hook||''} className="tj-conv-cover-hook" />
  : (
    <p className="tj-conv-dek">
      <EditableText field="dek-2" as="span" multiline>{spec.dek}</EditableText>
    </p>
  ));

/**
 * A story sent before its photographs: the cover typeset on the plain ground,
 * as the template-style Read covers are (Seven Steeps, The Long Way to the
 * Cup): the title, its bronze italic second line, a short rule under it, and
 * the hook. No placeholder plate, which would read as a photograph missing.
 */
const TypesetCover: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (
  <header className="tj-conv-cover-typeset" data-testid="conv-cover-typeset">
    <h1 className="tj-conv-title">
      <EditableText field="title-1" as="span">{spec.title[0]}</EditableText>
      {spec.title[1]&&<><br /><span className="tj-conv-title-2"><EditableText field="title-2" as="span">{spec.title[1]}</EditableText></span></>}
    </h1>
    <span aria-hidden="true" className="tj-conv-cover-rule" />
    <CoverWords spec={spec} />
  </header>
);

const Cover: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (!spec.portrait ? <TypesetCover spec={spec} /> : (
  <header className="tj-cover-dissolve tj-conv-cover">
    <CaptionedPhotoFrame shot={spec.portrait} className="tj-cover-photo tj-conv-cover-photo" style={{ background: 'linear-gradient(155deg,var(--tj-read-empty-from) 0%,var(--tj-read-bg) 80%)' }}>
      <EditablePhoto
        slot={spec.portrait.slot}
        alt={spec.portrait.alt}
        fill
        defaultPhoto={{ url: spec.images + spec.portrait.file, x: spec.portrait.x, y: spec.portrait.y }}
        placeholder={<div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />}
      />
    </CaptionedPhotoFrame>
    <div className="tj-cover-text tj-conv-cover-text">
      <h1 className="tj-conv-title">
        <EditableText field="title-1" as="span">{spec.title[0]}</EditableText>
        {spec.title[1]&&<><br /><span className="tj-conv-title-2"><EditableText field="title-2" as="span">{spec.title[1]}</EditableText></span></>}
      </h1>
      {spec.form === 'story' && (spec.hook || (spec as Partial<RecordedConversationSpec>).recordedFields?.hookId)
        ? <Passage id={(spec as Partial<RecordedConversationSpec>).recordedFields?.hookId} text={spec.hook||''} className="tj-conv-cover-hook" />
        : (
          <p className="tj-conv-dek">
            <EditableText field="dek-2" as="span" multiline>{spec.dek}</EditableText>
          </p>
        )}
    </div>
  </header>
));


export default function ConversationCanvas({spec,paragraphs}:{spec:ConversationSpec|RecordedConversationSpec;paragraphs?:{id:string;doc:JSONContent}[]}) {
 // Check the bounded tree before turnStarts or any recursive reader walks it.
 const check=(blocks:Block[],depth=0)=>{if(!Array.isArray(blocks)||blocks.length>2000||depth>8)throw Error('Unsupported nested article blocks.');for(const block of blocks){if(!block||!['q','a','n','line','side','glyph','photos','wide','bleed','on-photo'].includes(block.kind))throw Error('Unsupported article block.');if(block.kind==='side'||block.kind==='glyph')check(block.blocks,depth+1);}};
 if(!Array.isArray(spec.parts)||spec.parts.length>256)throw Error('Unsupported article parts.');check(spec.opening);for(const part of spec.parts)check(part.blocks);check(spec.ending.blocks);
 const recorded=spec as Partial<RecordedConversationSpec>,fields=recorded.recordedFields;
 const recordedRows=paragraphs||recorded.recordedParagraphs||[];
 const hasSaying=Boolean(spec.ending.saying.text||recordedRows.some(p=>p.id===spec.ending.saying.id));
 const hasClosing=Boolean(spec.closing||fields?.closingId);
 const speakers={...spec.speakers,starts:spec.form==='story'?new Set<string>():turnStarts(spec),named:spec.form!=='story'};
 return <RecordedPassages.Provider value={new Map(recordedRows.map(p=>[p.id,p.doc]))}><SpeakerCtx.Provider value={speakers}><article className="tj-conv" data-form={spec.form||'story'}>
 <style>{recordedStyle}</style>
 <Cover spec={spec}/>
 {(spec.intro||fields?.introId)&&<section className="tj-conv-col tj-conv-intro"><Passage id={fields?.introId} text={spec.intro} className="tj-conv-intro-text"/></section>}
 {groupRuns(spec.opening).map((block,i)=><BlockView key={i} spec={spec} block={block}/>)}
 {spec.parts.map((part,i)=><React.Fragment key={i}><PartOpening spec={spec} part={part} n={i+1} titleId={fields?.partTitleIds[i]}/>{groupRuns(part.blocks).map((block,j)=><BlockView key={j} spec={spec} block={block}/>)}</React.Fragment>)}
 {groupRuns(spec.ending.blocks).map((block,i)=><BlockView key={'e'+i} spec={spec} block={block}/>)}
 {hasSaying&&<section className="tj-conv-saying"><Line id={spec.ending.saying.id} text={spec.ending.saying.text} size="l"/>{!hasClosing&&<span aria-hidden="true" lang="zh-Hans" className="tj-conv-endmark">家</span>}</section>}
 {spec.ending.shot&&<figure className="tj-conv-close"><Photo spec={spec} shot={spec.ending.shot} aspect={spec.ending.aspect}/></figure>}
 {hasClosing&&<section className="tj-conv-col tj-conv-closing"><Passage id={fields?.closingId} text={spec.closing||''} className="tj-conv-intro-text"/><span aria-hidden="true" lang="zh-Hans" className="tj-conv-endmark">家</span></section>}
 <footer className="tj-conv-credit">{spec.credit.map((line,i)=><p key={i}>{line}</p>)}</footer>
 </article></SpeakerCtx.Provider></RecordedPassages.Provider>;
}
