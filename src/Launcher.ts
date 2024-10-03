import {App} from 'aws-cdk-lib'
import { EcsStack } from '../component/Ecs/EcsStack';

const app=new App();

new EcsStack(app,'EcsStack01',{
    env:{
        account:'610730766165',
        region:'us-east-1'
        
    }
})