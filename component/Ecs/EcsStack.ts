import {Size, Stack, StackProps } from "aws-cdk-lib"
import { ConnectionType, Integration, IntegrationType, RestApi, VpcLink } from "aws-cdk-lib/aws-apigateway"
import { Capacity } from "aws-cdk-lib/aws-dynamodb"
import { IpAddresses, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2"
import { AppProtocol, AwsLogDriverMode, Cluster, Compatibility, ContainerImage, CpuArchitecture, Ec2Service, FargateService, FargateTaskDefinition, LaunchType, LogDriver, NetworkMode, OperatingSystemFamily, Protocol, TaskDefinition } from "aws-cdk-lib/aws-ecs"
import { CapacityType, DefaultCapacityType } from "aws-cdk-lib/aws-eks"
import { IpAddressType, NetworkLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2"
import { ArnPrincipal, Effect, PolicyStatement, Role } from "aws-cdk-lib/aws-iam"
import { Construct } from "constructs"
import { networkInterfaces } from "os"

export class EcsStack extends  Stack{
    constructor(scope:Construct , id:string , props?:StackProps){
      super(scope,id,props)

    //create vpc

    const ecsVpc= new Vpc(this,'test-vpc',{
        availabilityZones: ['us-east-1a', 'us-east-1b'],
        ipAddresses:IpAddresses.cidr('10.10.10.0/24'),
       vpcName: 'cdk-ecs-vpc' ,
       natGateways:1,

    subnetConfiguration:[
        {
           cidrMask: 27,
           name: 'test-public-sub-1',
           subnetType: SubnetType.PUBLIC,

        }, {
            cidrMask: 27,
            name: 'test-public-sub-2',
            subnetType: SubnetType.PUBLIC,
            
            
         }
        ,{
            cidrMask:27,
            name: 'test-private-sub-1',
            subnetType:SubnetType.PRIVATE_WITH_EGRESS,
            
        },
            {
                cidrMask:27,
                name: 'test-private-sub-2',
                subnetType:SubnetType.PRIVATE_WITH_EGRESS,
                
            }
        

    ]


       })
   

    //create security group
    const sg=new SecurityGroup(this,'ecs-Sg-cdk',{
      vpc:ecsVpc,
      allowAllOutbound:true,
    })
    sg.addIngressRule(Peer.anyIpv4(),Port.allTraffic(), 'allow all traffic');


   //execution role
    const defaultExecutionRole=new Role(this, 'Execution-role',{
        assumedBy: new ArnPrincipal('*')
    })

     //policy
    defaultExecutionRole.addToPolicy(new PolicyStatement({
        effect:Effect.ALLOW,
        actions: [
            "ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "logs:CreateLogStream",
            "logs:PutLogEvents"

      ],
        resources: [  '*'  ],
      }));



    //create Farget cluster
    const ecsCluster= new Cluster(this,'EcsCluster',{
        vpc:ecsVpc,
        clusterName:'cdk-ecs-cluster',
        enableFargateCapacityProviders:true,
    })



    


    //create Taskdefination
    const EcsTaskDefination= new FargateTaskDefinition(this , 'TaskDefination',{
        family: 'cdk-task-defination',
        executionRole:defaultExecutionRole,
        taskRole: undefined,

        cpu: 1024,
        memoryLimitMiB: 2048,

      runtimePlatform:{
        operatingSystemFamily:OperatingSystemFamily.LINUX,
        cpuArchitecture:CpuArchitecture.X86_64
      },
    
      
    })


    //create container
    EcsTaskDefination.addContainer('react-container',{
        containerName:'nginx-con',
        essential:true,
        portMappings: [
            {
            containerPort: 80,
            hostPort:80,
            protocol:Protocol.TCP,
            name:'container-name',
            appProtocol:AppProtocol.http
            
        }
        ] ,
        image:ContainerImage.fromRegistry('nginx:latest'),
        readonlyRootFilesystem:false,
        cpu: 512,
        memoryLimitMiB: 512,
       logging:LogDriver.awsLogs({
        streamPrefix: 'real-app-event-cdk',
        mode:AwsLogDriverMode.NON_BLOCKING,
        maxBufferSize:Size.mebibytes(25),
       
       })

  
    })

        // create service
  const service= new FargateService(this,'EcsService',{
    serviceName: 'ecs-service',
    capacityProviderStrategies:[ {  capacityProvider:'FARGATE', weight:1  }],
    cluster: ecsCluster,
    taskDefinition: EcsTaskDefination,
    desiredCount: 1,
  securityGroups:[sg],
  vpcSubnets:{
    subnetType:SubnetType.PRIVATE_WITH_EGRESS
  },
  assignPublicIp:true,


  })

     //create NLB
     const nlb=new  NetworkLoadBalancer(this, 'EcsNetworkLoadBalancer',{
        loadBalancerName: 'cdk-nlb',
        vpc: ecsVpc,
        vpcSubnets:{
          onePerAz:true,
          subnetType:SubnetType.PUBLIC  
        },
        internetFacing: true,
        ipAddressType:IpAddressType.IPV4,
        securityGroups:[sg],  
        
    })



    const listener=nlb.addListener('Listener',{port:80})


  listener.addTargets('Target',{
    port:80,
    targets:[service]
  })



  //create api gateway


      const api= new RestApi(this, 'ApiForEcs',{ });
      const SpaceResource=api.root.addResource('ecs');


      const link = new VpcLink(this, 'link0101', {
        targets: [nlb],
        
      });
  
    const integration=new Integration({
     type:IntegrationType.HTTP_PROXY,
     integrationHttpMethod: 'ANY',
     options:{
        connectionType:ConnectionType.VPC_LINK,
       vpcLink:link
     }
    })

    SpaceResource.addMethod('GET',integration)

    }
}