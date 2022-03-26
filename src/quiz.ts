import { IQuestion, Util } from "./utils";
import { ICharacter, IMovie } from "./api";
import { AppSessionData, SessionManager } from "./sessionmanager";
import { Session } from "express-session";

export class Quiz {

    private static readonly maxQuestions = 15;

    private lastAnswers: [string, string] = ["", ""];
    private lastQuestionAsked?: IQuestion;

    private score: number = 0;
    private reviewQuestionIndex: number = 0;
    private passedQuestions: Map<IQuestion, number> = new Map(); // Question -> Score
    private passedQuestionsReply: [string, string][] = [];

    // Set
    public setLastQuestion = (question: IQuestion) => this.lastQuestionAsked = question;
    public addScore = (score: number) => this.score += score;

    // Get
    public getPassedQuestionsCount = (): number => this.passedQuestions.size;
    public getScore = (): number => this.score;
    public getPassedQuestions = (): Map<IQuestion, number> => this.passedQuestions;
    public getLastQuestionAsked = (): IQuestion => this.lastQuestionAsked!;
    public isFinished = (): boolean => this.passedQuestions.size == Quiz.maxQuestions;

    private async wrapQuestionOutput(originalData: QuizData): Promise<void> {
        if (this.getLastQuestionAsked() == undefined) await this.createAndSetNewQuestion();

        let question: IQuestion = this.getLastQuestionAsked();

        this.wrapQuestionDirect(originalData, question);

        originalData.questionIndex = this.passedQuestions.size;
        originalData.questionIndexMax = Quiz.maxQuestions;
    }

    private wrapQuestionDirect(originalData: QuizData, question: IQuestion): void {
        originalData.question = question.Dialog;
        let combined: (IMovie | ICharacter)[] = [];
        originalData.quoteId = question.QuoteId;
        combined = combined.concat(question.BadAnswers, question.CorrectAnswers);
        originalData.possibleCharacters = combined.filter((v: any, i, a) => v.hair != undefined) as ICharacter[]
        originalData.possibleMovies = combined.filter((v: any, i, a) => !originalData.possibleCharacters?.includes(v)) as IMovie[];
        Util.INSTANCE.shuffle(originalData.possibleCharacters, Math.floor((Math.random() * 15) + 3));
        Util.INSTANCE.shuffle(originalData.possibleMovies, Math.floor((Math.random() * 15) + 3));
    }

    private getPassedQuestionFromIndex(index: number): IQuestion {
        let x = 0;
        let question: IQuestion | undefined = undefined;

        this.getPassedQuestions().forEach((k, v) => {
            if (x++ == index) question = v;
        });

        return question!;
    }

    private async wrapScoreBoardOutput(originalData: QuizReview): Promise<void> {
        originalData.answeredQuestionsMap = this.getPassedQuestions();
    }

    private async nextQuestionAndSaveOld(score: number): Promise<void> {
        this.passedQuestions.set(this.getLastQuestionAsked(), score)
        if (!this.isFinished()) await this.createAndSetNewQuestion();
        else this.reviewQuestionIndex = 0;
    }

    private async createAndSetNewQuestion(): Promise<void> {
        let question: IQuestion = await Util.INSTANCE.QuestionGenerator();
        this.setLastQuestion(question);
    }

    private hasActuallyAnswered(movie: string | undefined, character: string | undefined): boolean {
        return this.lastAnswers[0] != movie || this.lastAnswers[1] != character;
    }

    // Static

    public static async getQuizForSession(session: Session): Promise<Quiz> {
        let data: AppSessionData = await SessionManager.getDataFromSession(session);
        return data.quiz!;
    }

    public static async createQuizForSession(session: Session): Promise<Quiz> {
        await SessionManager.updateSessionData(session, app => app.quiz = new Quiz());
        return (await SessionManager.getDataFromSession(session)).quiz!;
    }

    public static async destroyQuizForSession(session: Session): Promise<Quiz> {
        await SessionManager.updateSessionData(session, app => app.quiz = undefined);
        return undefined!;
    }

    // Page Handling 
    public static process(req: any, res: any) {
        this.common(req, res);
    }

    public async processAnswer(dataBody: any) {
        if (this.hasActuallyAnswered(dataBody.movie, dataBody.character)) {
            this.lastAnswers = [dataBody.movie, dataBody.character];
            this.passedQuestionsReply[this.passedQuestionsReply.length] = this.lastAnswers;
            let lastQuestion: IQuestion = this.getLastQuestionAsked();

            const score = lastQuestion.CorrectAnswers.filter(t => t.name == dataBody.movie || t.name == dataBody.character).length * 0.5;
            this.addScore(score);
            await this.nextQuestionAndSaveOld(score);
        }
    }

    private static async common(req: any, res: any) {
        let session: Session = req.session;
        let dataBody: any = req.body;
        let quiz: Quiz = await this.getQuizForSession(session);

        if (!quiz && dataBody.startQuiz) quiz = await this.createQuizForSession(session);
        if (dataBody.reset) quiz = await this.destroyQuizForSession(session);
        if ((dataBody.movie != undefined || dataBody.character != undefined) && quiz != undefined) await quiz.processAnswer(dataBody);

        let outData: QuizData = {
            title: "Quiz",
            quizState: quiz != undefined ? (quiz.isFinished() ? "done" : "active") : "begin"
        };

        switch (outData.quizState) {
            case "active":
                await quiz.wrapQuestionOutput(outData);
                outData.score = quiz.getScore();
                break;

            case "done":
                if (dataBody.prevQuestion != undefined) {
                    if (quiz.reviewQuestionIndex - 1 >= 0) quiz.reviewQuestionIndex--;
                } else if (dataBody.nextQuestion != undefined) {
                    if (quiz.reviewQuestionIndex + 1 < quiz.getPassedQuestions().size) quiz.reviewQuestionIndex++;
                }

                outData.score = quiz.getScore();
                outData.questionIndex = quiz.reviewQuestionIndex;
                outData.questionIndexMax = Quiz.maxQuestions;

                outData.quizReview = { userAnswers: quiz.passedQuestionsReply[outData.questionIndex] }
                let quizReviewData = outData.quizReview;

                let question = quiz.getPassedQuestionFromIndex(outData.questionIndex);
                quizReviewData.correctAnswers = question.CorrectAnswers;

                quiz.wrapQuestionDirect(outData, question);
                quiz.wrapScoreBoardOutput(quizReviewData);
                break;
        }

        res.render(`quiz-${outData.quizState}`, outData);
    }
}

export interface QuizData {
    title: string;
    quizState: string;

    questionIndex?: number;
    questionIndexMax?: number;

    score?: number;
    quoteId?: string;
    question?: string;

    possibleMovies?: IMovie[];
    possibleCharacters?: ICharacter[];

    quizReview?: QuizReview;

}

export interface QuizReview {
    correctAnswers?: (IMovie | ICharacter)[];
    answeredQuestionsMap?: Map<IQuestion, number>;
    userAnswers: [string, string]
}