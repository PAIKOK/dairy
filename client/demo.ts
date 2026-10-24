import type {Book} from '../shared/types';
export const DEMO_DATE='2027-05-15';
export function demoBook(): Book {
 return {
  profile:{id:'demo',name:'Alex',email:'demo@example.test',timeZone:'Asia/Kolkata',weekStart:1,createdAt:'2027-01-01T00:00:00Z'},aiEnabled:false,
  entries:[
   {date:DEMO_DATE,title:'The art of a slower Saturday',body:'An unhurried morning. Coffee in my favourite cup, the windows open, nowhere I needed to be.\n\nI took the long way home through the park. The light was coming through the trees in that almost-golden way. I think I’m learning to notice the little things.\n\nA little reminder: a good day doesn’t have to be a big day.',mood:'quiet',favorite:true,page:{paper:'lined',ink:'plum',font:'hand',note:'The slow mornings. The good company. More of this.',stickers:[{id:'11111111-1111-4111-8111-111111111111',kind:'daisy',x:87,y:81,rotation:-12,scale:.95},{id:'22222222-2222-4222-8222-222222222222',kind:'stamp',x:73,y:88,rotation:8,scale:.75}],doodles:[]},version:1,updatedAt:'2027-05-15T10:30:00Z'},
   {date:'2027-05-12',title:'A walk, and a little perspective',body:'We walked until the path turned into a trail. No perfect plan, just green everywhere and a conversation I want to remember.',mood:'good',favorite:true,version:1,updatedAt:'2027-05-12T10:00:00Z'},
   {date:'2027-05-09',title:'Sunday, softly',body:'Made pancakes. Called home. Watched the light change. Enough.',mood:'joyful',favorite:false,version:1,updatedAt:'2027-05-09T10:00:00Z'},
   {date:'2027-05-04',title:'A small beginning',body:'Read a few pages before reaching for my phone. Keeping that little promise to myself.',mood:'good',favorite:false,version:1,updatedAt:'2027-05-04T10:00:00Z'}
  ],
  memories:[{id:'forest',photoId:'forest',date:'2027-05-12',caption:'Taking the scenic route',alt:'Sunlight falling through a green forest canopy',image:'/life/forest.jpg'},{id:'coffee',photoId:'coffee',date:DEMO_DATE,caption:'Coffee and good company',alt:'Hands holding three cups of coffee together',image:'/life/coffee.jpg'},{id:'morning',photoId:'morning',date:'2027-05-09',caption:'Before the world woke up',alt:'Early sunlight over a misty meadow',image:'/life/morning.jpg'}],
  goals:[{id:'read',title:'Make more room for reading',target:12,completed:4,kind:'goal',checks:[],createdAt:'2027-01-01T00:00:00Z'},{id:'outside',title:'A little time outside',target:7,completed:3,kind:'habit',checks:['2027-05-12','2027-05-13','2027-05-15'],createdAt:'2027-01-01T00:00:00Z'}],
  letters:[{id:'open',title:'For a day you need a little kindness',body:'Dear me,\n\nYou don’t have to have it all figured out. Notice how far you’ve come. Keep a little room for joy.\n\nWith love, your January self',unlockDate:'2027-05-01',timeZone:'Asia/Kolkata',createdAt:'2027-01-02T12:00:00Z',unlocked:true},{id:'future',title:'See you at the end of the year',body:'Dear future me,\n\nI hope this year surprised you in the best little ways.',unlockDate:'2027-12-31',timeZone:'Asia/Kolkata',createdAt:'2027-01-02T12:00:00Z',unlocked:false}],
  songs:[{id:'song1',title:'Bloom',artist:'The Paper Kites',url:'https://www.youtube.com/results?search_query=The+Paper+Kites+Bloom',date:DEMO_DATE,note:'For mornings that don’t need rushing.'}]
 };
}
