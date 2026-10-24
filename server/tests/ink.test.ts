import {test} from 'node:test';
import assert from 'node:assert/strict';
import {strokeHitsEraser} from '../../client/inkEraser';
import type {InkStroke} from '../../shared/notebook';
const line:InkStroke={id:'test',color:'plum',width:2.2,points:[[10,50],[90,50]]};
test('eraser uses pixel-sized hit areas and detects fast crossings, not just endpoints',()=>{
 assert.equal(strokeHitsEraser(line,[100,310],[200,310],300,600,12),true);
 assert.equal(strokeHitsEraser(line,[100,320],[200,320],300,600,12),false);
 assert.equal(strokeHitsEraser(line,[150,200],[150,400],300,600,12),true);
 assert.equal(strokeHitsEraser(line,[10,200],[10,400],300,600,12),false);
});
test('eraser handles ink dots, touching endpoints, and changing page sizes',()=>{
 const dot={...line,points:[[50,50],[50,50]] as [number,number][]};
 assert.equal(strokeHitsEraser(dot,[150,300],[150,300],300,600,12),true);
 assert.equal(strokeHitsEraser(dot,[190,300],[190,300],300,600,12),false);
 assert.equal(strokeHitsEraser(line,[270,300],[270,300],300,600,12),true);
 assert.equal(strokeHitsEraser(line,[300,300],[300,300],300,600,12),false);
 assert.equal(strokeHitsEraser(line,[300,350],[300,450],600,800,12),true);
});
