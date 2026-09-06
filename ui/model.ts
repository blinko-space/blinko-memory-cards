export const DECK_TYPE_KEY="flashcard.deck";
export type Grade="again"|"hard"|"good";
export type Flashcard={id:string;question:string;answer:string;tags:string[];createdAt:string;updatedAt:string;dueDate:string;intervalDays:number;ease:number;repetitions:number;lastReviewedAt?:string};
export type Deck={title:string;cards:Flashcard[]};
export const todayKey=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
export const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return todayKey(value);};
const clean=(value:unknown,max:number)=>String(value??"").replace(/[<>]/g,"").trim().slice(0,max);
const timestamp=()=>new Date().toISOString();
const id=()=>`card_${crypto.randomUUID()}`;

export function createDeck(title:string):Deck{return{title:clean(title,160)||"Untitled deck",cards:[]};}
export function createCard(input:{question:string;answer:string;tags?:string[]},today=todayKey()):Flashcard{const now=timestamp();return{id:id(),question:clean(input.question,4000)||"Untitled question",answer:clean(input.answer,8000),tags:[...new Set((input.tags??[]).map((tag)=>clean(tag,40)).filter(Boolean))].slice(0,20),createdAt:now,updatedAt:now,dueDate:today,intervalDays:0,ease:2.5,repetitions:0};}
export function parseDeck(value:string):Deck{
  const source=JSON.parse(value) as Partial<Deck>;if(!source||!Array.isArray(source.cards))throw new Error("INVALID_DECK");const seen=new Set<string>();
  const cards=source.cards.slice(0,2000).map((raw)=>{const item=raw as Partial<Flashcard>;const cardId=clean(item.id,120);if(!cardId||seen.has(cardId))throw new Error("INVALID_DECK");seen.add(cardId);const createdAt=Number.isFinite(Date.parse(String(item.createdAt)))?String(item.createdAt):timestamp();const dueDate=/^\d{4}-\d{2}-\d{2}$/.test(String(item.dueDate))?String(item.dueDate):todayKey();return{id:cardId,question:clean(item.question,4000)||"Untitled question",answer:clean(item.answer,8000),tags:[...new Set((Array.isArray(item.tags)?item.tags:[]).map((tag)=>clean(tag,40)).filter(Boolean))].slice(0,20),createdAt,updatedAt:Number.isFinite(Date.parse(String(item.updatedAt)))?String(item.updatedAt):createdAt,dueDate,intervalDays:Math.max(0,Math.min(36500,Math.round(Number(item.intervalDays)||0))),ease:Math.max(1.3,Math.min(3,Number(item.ease)||2.5)),repetitions:Math.max(0,Math.round(Number(item.repetitions)||0)),...(item.lastReviewedAt&&Number.isFinite(Date.parse(String(item.lastReviewedAt)))?{lastReviewedAt:String(item.lastReviewedAt)}:{})};});
  return{title:clean(source.title,160)||"Untitled deck",cards};
}
export function serializeDeck(deck:Deck){const value=JSON.stringify(deck);if(value.length>780000)throw new Error("DECK_TOO_LARGE");return value;}
export const flattenCardText=(deck:Deck)=>deck.cards.flatMap((card)=>[card.question,card.answer,...card.tags]).filter(Boolean).join("\n").slice(0,300000);
export const addCard=(deck:Deck,card:Flashcard):Deck=>{if(deck.cards.length>=2000)throw new Error("DECK_TOO_LARGE");return{...deck,cards:[...deck.cards,card]};};
export const updateCard=(deck:Deck,cardId:string,input:{question:string;answer:string;tags:string[]}):Deck=>({...deck,cards:deck.cards.map((card)=>card.id===cardId?{...card,question:clean(input.question,4000)||card.question,answer:clean(input.answer,8000),tags:[...new Set(input.tags.map((tag)=>clean(tag,40)).filter(Boolean))].slice(0,20),updatedAt:timestamp()}:card)});
export const deleteCard=(deck:Deck,cardId:string):Deck=>({...deck,cards:deck.cards.filter((card)=>card.id!==cardId)});
export function reviewCard(card:Flashcard,grade:Grade,today=todayKey()):Flashcard{
  let ease=card.ease,interval=card.intervalDays,repetitions=card.repetitions;
  if(grade==="again"){ease=Math.max(1.3,ease-.2);interval=1;repetitions=0;}
  else if(grade==="hard"){ease=Math.max(1.3,ease-.05);interval=Math.max(1,Math.round((interval||1)*1.2));repetitions+=1;}
  else{interval=repetitions===0?1:repetitions===1?3:Math.max(4,Math.round((interval||1)*ease));ease=Math.min(3,ease+.05);repetitions+=1;}
  return{...card,ease,intervalDays:interval,repetitions,dueDate:addDays(today,interval),lastReviewedAt:timestamp(),updatedAt:timestamp()};
}
export const applyReview=(deck:Deck,cardId:string,grade:Grade,today=todayKey()):Deck=>({...deck,cards:deck.cards.map((card)=>card.id===cardId?reviewCard(card,grade,today):card)});
export const dueCards=(deck:Deck,today=todayKey())=>deck.cards.filter((card)=>card.dueDate<=today);

export function parseAiDeckDraft(value:string):Deck{
  const raw=value.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  const source=JSON.parse(raw) as {title?:unknown;cards?:unknown};
  if(!source||!Array.isArray(source.cards)||source.cards.length<1)throw new Error("INVALID_AI_DECK");
  let deck=createDeck(String(source.title??""));
  for(const item of source.cards.slice(0,100)){
    if(!item||typeof item!=="object")continue;
    const card=item as {question?:unknown;answer?:unknown;tags?:unknown};
    const question=clean(card.question,4000),answer=clean(card.answer,8000);
    if(!question||!answer)continue;
    deck=addCard(deck,createCard({question,answer,tags:Array.isArray(card.tags)?card.tags.map(String):[]}));
  }
  if(!deck.cards.length)throw new Error("INVALID_AI_DECK");
  return deck;
}
