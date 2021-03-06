import session, { Session } from "express-session";
import fs from "fs";
import { Api, ICharacter, IMovie, IQuote } from "./api";
import { IQuoteRate, QuoteRate } from "./quoterate";
import { SessionManager } from "./sessionmanager";
export const QuotesPath: string = "./quotes.json";
export const CharacterPath: string = "./characters.json";
export const MoviePath: string = "./movies.json";
var htmlToPdf = require('html-to-pdf');
import path from "path";

/*
Quick guide voor question generator:
1. import class
2. defineer class object "let generator: Util = new Util();"
3. mocht dit nog niet gebeurd zijn creër json files met CreateJsonFiles
4. gebruik QuestionGenerator function (uses promises)
voorbeeld:
```
let Generator: Util = new Util();
Generator.QuestionGenerator().then((question) => {
  console.log(question);
});

```
sidenotes:
QuotesPath,CharacterPath,MoviePath
Hebben een absoluut pad nodig naar de databases.

*/
export class Util {
  public static INSTANCE = new Util();

  constructor() {
      this.readAndWriteFromAPI();
  }

  // Question stuff

  private async readAndWriteFromAPI(): Promise<void> {
    this.createJsonFiles();
    let Q: IQuote[] = await Api.GetQuotes();
    fs.writeFileSync(QuotesPath, JSON.stringify(Q));
    let M: IMovie[] = await Api.GetMovies();
    fs.writeFileSync(MoviePath, JSON.stringify(M));
    let C: ICharacter[] = await Api.GetCharacters();
    fs.writeFileSync(CharacterPath, JSON.stringify(C));

  }

  public async QuestionGenerator(session: Session): Promise<IQuestion> {
    let Question: IQuestion;

    do {
      let Data: IQuote[] = await this.GetData(QuotesPath);
      let RandomQuote: IQuote;
      do {
        RandomQuote = Data[Math.floor(Math.random() * Data.length)];
      } while (RandomQuote.dialog.length >= 271);
      let CorrectAnswers: [ICharacter, IMovie] = [
        await this.GetCharacter(RandomQuote.character),
        await this.GetMovie(RandomQuote.movie),
      ];

      let BadAnswers: (IMovie | ICharacter)[] = await this.GetBadMovies(CorrectAnswers[1]._id);
      BadAnswers = BadAnswers.concat(await this.GetBadCharacters(CorrectAnswers[0]._id));

      Question = {
        QuoteId: RandomQuote.id,
        Dialog: RandomQuote.dialog,
        CorrectAnswers: CorrectAnswers,
        BadAnswers: BadAnswers,
      };
    } while (this.isBlacklisted(session, Question));

    return Question;
  }

  public getBlacklistedQuotesRates(session: Session): IQuoteRate[] {
    let rates: IQuoteRate[] = SessionManager.GetDataFromSession(session).blacklisted;
    return rates;
  }

  public async getBlacklistedQuotes(session: Session): Promise<IQuote[]> {
    let rates: IQuoteRate[] = SessionManager.GetDataFromSession(session).blacklisted;
    let allQuotes: IQuote[] = await this.GetData(QuotesPath);
    let quoteList: IQuote[] = [];

    rates.forEach(rate => quoteList.push(allQuotes.find(quote => quote._id == rate.quoteId)!));

    return quoteList;
  }

  public getFavouritedQuotesRates(session: Session): IQuoteRate[] {
    let rates: IQuoteRate[] = SessionManager.GetDataFromSession(session).favorites;
    return rates;
  }

  public async getFavouritedQuotes(session: Session): Promise<IQuote[]> {
    let rates: IQuoteRate[] = SessionManager.GetDataFromSession(session).favorites;
    let allQuotes: IQuote[] = await this.GetData(QuotesPath);
    let quoteList: IQuote[] = [];

    rates.forEach(rate => quoteList.push(allQuotes.find(quote => quote._id == rate.quoteId)!));

    return quoteList;
  }

  private async GetMovie(movieid: string): Promise<IMovie> {
    let Data: IMovie[] = await this.GetData(MoviePath);
    let DataLength: number = Data.length;

    for (let i = 0; i < DataLength; i++) {
      if (Data[i]._id == movieid) return Data[i];
    }

    throw new Error("Movie not found.");
  }

  private async GetCharacter(characterid: string): Promise<ICharacter> {
    let Data: ICharacter[] = await this.GetData(CharacterPath);
    let DataLength: number = Data.length;

    for (let i = 0; i < DataLength; i++) {
      if (Data[i]._id == characterid) return Data[i];
    }

    throw new Error("Character not found.");
  }

  private async GetBadMovies(correctMovieId: string): Promise<IMovie[]> {
    let Data: IMovie[] = await this.GetData(MoviePath);
    let RandomMovies: IMovie[] = [];

    for (let i = 0; i < 2; i++) {
      let randomMovie: IMovie;

      do {
        randomMovie = Data[Math.floor(Math.random() * Data.length)];
      } while (randomMovie._id == correctMovieId || RandomMovies.find((movie) => movie._id == randomMovie._id));

      RandomMovies.push(randomMovie);
    }

    return RandomMovies;
  }

  private async GetBadCharacters(correctCharacterId: string): Promise<ICharacter[]> {
    let Data: ICharacter[] = await this.GetData(CharacterPath);
    let RandomCharacters: ICharacter[] = [];

    for (let index = 0; index < 2; index++) {
      let randomCharacter: ICharacter;

      do {
        randomCharacter = Data[Math.floor(Math.random() * Data.length)];
      } while (randomCharacter._id == correctCharacterId || RandomCharacters.find((char) => char._id == randomCharacter._id));

      RandomCharacters.push(randomCharacter);
    }

    return RandomCharacters;
  }

  public async GetData(path: string): Promise<any[]> {
    let rawData = fs.readFileSync(path, "utf-8");
    let Data: string[] = await JSON.parse(rawData);
    return Data;
  }

  private isBlacklisted(session: Session, question: IQuestion): boolean {
    let blacklistedData: IQuoteRate[] = this.getBlacklistedQuotesRates(session);

    for (let i = 0; i < blacklistedData.length; i++) {
      if (blacklistedData[i].quoteId == question.QuoteId) return true;
    }

    return false;
  }

  public async UpdateFavoriteFile(session: Session) {
    let list = await this.getFavouritedQuotes(session);
    let text = "";
    for (let i = 0; i < list.length; i++) {
      text += `${list[i].dialog} - `
      text += `${await (await this.GetCharacter(list[i].character)).name}\n`;
    }

    await fs.writeFileSync("./public/assets/text/favorite.txt", text);
  }



  public async UpdateFavoriteCharacterFile(session: Session) {


    let characters = await (await this.CreateFavouriteCharactersList(session));
    let text = "";
    for (let i = 0; i < characters.length; i++) {
      text += `Your favorite character is ${characters[i].name}.\n`; 
      if (characters[i]. birth != "") text += `This character was born ${characters[i].birth}.\n`
      if (characters[i].gender != "") text += `This character is a ${characters[i].gender}.\n`
      if (characters[i].race != "") text += `This character is a ${characters[i].race}\n`
      if (characters[i].realm != "") text += `from the realm ${characters[i].realm}.\n`
      if (characters[i].death != "") text += `He died on:  ${characters[i].death}.\n`
      if (characters[i].height != "") text += `He is ${characters[i].height} in height.\n`
      if (characters[i].spouse != "") text += `He is together with ${characters[i].spouse}.]\n`
      if (characters[i].hair != "") text += `His hair is:  ${characters[i].hair}.\n`
      text += 'Your favorite quotes of this character are:\n'
      for (let x = 0; x < characters[i].favouritedQuotes!.length; x++) {
        text += `${x + 1}. ${characters[i].favouritedQuotes![x].dialog}\n`
      }
       await fs.writeFileSync("./public/assets/text/favoriteCharacters.txt", text);
    }


    /*htmlToPdf.convertHTMLFile('../views/Favoritecharacter.ejs', './public/assets/text/favorite.pdf',
    (error: any, success: any) => {
      if (error) {
        console.log('Oh noes! Errorz!');
        console.log(error);
      } else {
        console.log('Woot! Success!');
        console.log(success);
      }
    }
  );*/
}

  public createJsonFiles(filesToCreate: string[] = [QuotesPath, CharacterPath, MoviePath]) {

    for (let i = 0; i < filesToCreate.length; i++) {
      if (!fs.existsSync(filesToCreate[i])) {
        fs.appendFileSync(filesToCreate[i], "[{}]");
        console.log(filesToCreate[i], " is created");
      }
    }
  }

  public AssureMoveBetween(currentIndex: number, minIndex: number, maxIndex: number, indexCallback: { (index: number): number }) {
    let index = indexCallback(currentIndex);
    return index > maxIndex ? maxIndex : index < minIndex ? minIndex : index;
  }

  // Other utils
  public shuffle(array: any[], times: number) {
    if (array == undefined || array.length == 0) return;

    for (let x = 0; x < times; x++) {
      let randIndex = Math.floor(Math.random() * array.length);
      let temp: any = array[randIndex];
      array[randIndex] = array[0];
      array[0] = temp;
    }
  }

  public async CreateFavouriteCharactersList(session:Session):Promise<ICharacter[]>{
    let favouriteQuotes:IQuote[]  = await this.getFavouritedQuotes(session);
    let blacklistedQuotes:IQuote[] = await this.getBlacklistedQuotes(session);
    let Characters:ICharacter[] = await this.GetData(CharacterPath);  
    let filteredCharacters:ICharacter[];
    filteredCharacters =Characters.filter((char)=>{
      let currentID:string=char._id;
      let count:number = favouriteQuotes.reduce((acc,cur)=> cur.character == currentID ? ++acc:acc,0);
      if(count>2 && !blacklistedQuotes.find(blacklisted=>{
        return blacklisted.character ==char._id;
      })&& favouriteQuotes.find(favourited=>{        
        return favourited.character ==char._id;
      })){
        return true
      };
    })
    filteredCharacters.forEach(character => {
      character.favouritedQuotes = [];
      for (let i = 0; i < favouriteQuotes.length; i++) {
        if(character._id == favouriteQuotes[i].character){
          character.favouritedQuotes.push(favouriteQuotes[i])
        }
    }
    });
    return filteredCharacters;
    }

  public orderReccentFiles = (dir: string) => {
    return fs.readdirSync(dir)
    .filter(f => fs.lstatSync(dir + "/" + f).isFile())
    .map(file => ({ file, mtime: fs.lstatSync(dir + "/" + file).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  }

  public getMostRecentFile = (dir: string) => {
    const files = this.orderReccentFiles(dir);
    return files.length ? files[0] : undefined;
  };
}


export interface IQuestion {
  QuoteId: string;
  Dialog: string;
  rating?: boolean;
  CorrectAnswers: (IMovie | ICharacter)[];
  BadAnswers: (IMovie | ICharacter)[];
}
