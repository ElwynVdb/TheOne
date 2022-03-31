import fs from "fs";
import { Api, ICharacter, IMovie, IQuote } from "./api";
import { Database } from "./database";
const QuotesPath: string = "./quotes.json";
const CharacterPath: string = "./characters.json";
const MoviePath: string = "./movies.json";
const BlacklistedPath: string = "./blacklist.json";
const favouritePath: string = "./favourites.json";

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
    try {
      this.readAndWriteFromAPI();//
    } catch (e) {
      console.log(e);
    }
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
    let BQ: IQuestion[] = await Database.GetDocuments(Database.BLACKLIST, {});
    fs.writeFileSync(BlacklistedPath, JSON.stringify(BQ));
  }

  public async QuestionGenerator(): Promise<IQuestion> {
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

      let BadAnswers: (IMovie | ICharacter)[] = await this.GetBadMovies(
        CorrectAnswers[1]._id
      );
      BadAnswers = BadAnswers.concat(
        await this.GetBadCharacters(CorrectAnswers[0]._id)
      );

      Question = {
        QuoteId: RandomQuote.id,
        Dialog: RandomQuote.dialog,
        CorrectAnswers: CorrectAnswers,
        BadAnswers: BadAnswers,
      };
    } while (this.isBlacklisted(Question));

    return Question;
  }

  public getBlacklistedQuestions(): IQuote[] {
    let rawData = fs.readFileSync(BlacklistedPath, "utf-8");
    let data: IQuote[] = JSON.parse(rawData);
    return data;
  }

  public async getFavouritedQuestions(): Promise<IQuestion[]> {
    let rawDAta = fs.readFileSync(favouritePath, "utf-8");
    let data: IQuestion[] = JSON.parse(rawDAta);
    return data;
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

      do randomMovie = Data[Math.floor(Math.random() * Data.length)];
      while (
        randomMovie._id == correctMovieId ||
        RandomMovies.find((movie) => movie._id == randomMovie._id)
      );

      RandomMovies.push(randomMovie);
    }

    return RandomMovies;
  }

  private async GetBadCharacters(
    correctCharacterId: string
  ): Promise<ICharacter[]> {
    let Data: ICharacter[] = await this.GetData(CharacterPath);
    let RandomCharacters: ICharacter[] = [];
    for (let index = 0; index < 2; index++) {
      let randomCharacter: ICharacter;

      do randomCharacter = Data[Math.floor(Math.random() * Data.length)];
      while (
        randomCharacter._id == correctCharacterId ||
        RandomCharacters.find((char) => char._id == randomCharacter._id)
      );

      RandomCharacters.push(randomCharacter);
    }

    return RandomCharacters;
  }

  private async GetData(path: string): Promise<any[]> {
    let rawData = fs.readFileSync(path, "utf-8");
    let Data: string[] = await JSON.parse(rawData);
    return Data;
  }

  private isBlacklisted(question: IQuestion): boolean {
    let blacklistedData: IQuestion[] = JSON.parse(
      fs.readFileSync(BlacklistedPath, "utf-8")
    );

    for (let i = 0; i < blacklistedData.length; i++) {
      if (blacklistedData[i].QuoteId == question.QuoteId) return true;
    }

    return false;
  }

  public createJsonFiles(
    filesToCreate: string[] = [
      QuotesPath,
      CharacterPath,
      MoviePath,
      favouritePath,
      BlacklistedPath,
    ]
  ) {
    for (let i = 0; i < filesToCreate.length; i++) {
      if (!fs.existsSync(filesToCreate[i])) {
        fs.appendFileSync(filesToCreate[i], "[{}]");
        console.log(filesToCreate[i], " is created");
      }
    }
  }

  public AssureMoveBetween(
    currentIndex: number,
    minIndex: number,
    maxIndex: number,
    indexCallback: { (index: number): number }
  ) {
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
}

export interface IQuestion {
  QuoteId: string;
  Dialog: string;
  rating?: boolean;
  CorrectAnswers: (IMovie | ICharacter)[];
  BadAnswers: (IMovie | ICharacter)[];
}
